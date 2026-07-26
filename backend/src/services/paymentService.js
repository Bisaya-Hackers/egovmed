'use strict';
const egovPay = require('../integrations/egovPay');
const { getStore, COLLECTIONS } = require('../store');
const { randomId } = require('../lib/crypto');
const { notFound } = require('../lib/errors');

// Simplified, transparent benefit rules for the demo. Real coverage comes from the payer APIs.
// Rates for PWD/Senior mirror the statutory 20% medical discount (RA 10754 / RA 9994); Solo
// Parent mirrors the 10% medicine discount (RA 11861 as amended). The rest are illustrative
// approximations of each program's typical assistance share, same as the original 3.
const BENEFIT_RULES = {
  whiteCard: { label: 'White Card (indigent)', rate: 1.0 }, // full coverage at public hospitals
  aics: { label: 'DSWD AICS', rate: 0.5 },
  philhealth: { label: 'PhilHealth', rate: 0.6 }, // covers up to 60% of the demo bill
  ecc: { label: 'ECC (Employees’ Compensation)', rate: 0.4 },
  owwa: { label: 'OWWA', rate: 0.3 },
  fourps: { label: '4Ps (Pantawid Pamilyang Pilipino Program)', rate: 0.15 },
  sss: { label: 'SSS', rate: 0.2 },
  gsis: { label: 'GSIS', rate: 0.2 },
  pwd: { label: 'PWD ID discount', rate: 0.2 },
  senior: { label: 'Senior Citizen discount', rate: 0.2 },
  soloParent: { label: 'Solo Parent ID discount', rate: 0.1 },
  pagibig: { label: 'Pag-IBIG Fund', rate: 0.1 },
};
const BENEFIT_ORDER = ['whiteCard', 'aics', 'philhealth', 'ecc', 'owwa', 'fourps', 'sss', 'gsis', 'pwd', 'senior', 'soloParent', 'pagibig'];

const round2 = (n) => Math.round(n * 100) / 100;

function computeBenefits(billAmount, benefits = {}) {
  // `source: 'mock'` + disclaimer are returned on the wire so the client/judges never mistake
  // these for a live determination against the payer APIs.
  const mockMeta = { source: 'mock', disclaimer: 'Estimated benefits — not a live determination from PhilHealth, SSS, GSIS, or any other payer.' };
  if (!Number.isFinite(billAmount) || billAmount <= 0) return { applied: [], coveredTotal: 0, balance: 0, ...mockMeta };

  let remaining = billAmount;
  const applied = [];
  // Highest-impact programs first (e.g. White Card can fully cover) so more generous benefits
  // aren't crowded out by smaller ones when a patient has several active at once.
  //
  // Every *active* benefit is listed here, even ones that end up covering ₱0 because an
  // earlier, higher-priority benefit already zeroed out the remaining balance. We used to
  // `break` out of the loop as soon as `remaining` hit 0, which silently dropped any
  // lower-priority benefit a patient had switched on from the "Benefits Applied" list — making
  // it look like the app forgot they ticked it, when really it just had nothing left to cover.
  for (const key of BENEFIT_ORDER) {
    if (!benefits[key]?.active) continue;
    const covered = round2(Math.min(remaining, billAmount * BENEFIT_RULES[key].rate));
    applied.push({ program: key, label: BENEFIT_RULES[key].label, amount: covered, mock: true });
    remaining = round2(remaining - covered);
  }
  return { applied, coveredTotal: round2(billAmount - remaining), balance: Math.max(0, round2(remaining)), ...mockMeta };
}

async function createBill({ patientId, billAmount, description = 'Hospital services', channel = 'any', appointmentId = null }) {
  const store = getStore();
  const patient = await store.findById(COLLECTIONS.PATIENTS, patientId);
  if (!patient) throw notFound('Patient not found');

  // If the caller attached this payment to an appointment, confirm the appointment belongs to
  // the paying patient — otherwise a caller could attach their payment to any known appointment
  // id, corrupting attribution and any future per-appointment payment listing. 404 (not 403) on
  // ownership mismatch so the appointment's existence is never disclosed.
  if (appointmentId) {
    const appt = await store.findById(COLLECTIONS.APPOINTMENTS, appointmentId);
    if (!appt || appt.patientId !== patientId) throw notFound('Appointment not found');
  }

  const { applied, coveredTotal, balance } = computeBenefits(billAmount, patient.benefits);
  const checkout = await egovPay.createCheckout({
    amount: balance, description, channel,
  });

  const payment = {
    id: randomId('bill_'),
    patientId,
    appointmentId,
    billAmount,
    benefitsApplied: applied,
    coveredTotal,
    balance,
    channel,
    reference: checkout.reference,
    checkoutUrl: checkout.checkoutUrl,
    status: checkout.status,
    provider: checkout.provider,
    createdAt: new Date().toISOString(),
  };
  await store.create(COLLECTIONS.PAYMENTS, payment);
  return payment;
}

async function refreshStatus(billId, patientId) {
  const store = getStore();
  const payment = await store.findById(COLLECTIONS.PAYMENTS, billId);
  if (!payment || payment.patientId !== patientId) throw notFound('Bill not found');
  const status = await egovPay.getStatus(payment.reference);
  return store.update(COLLECTIONS.PAYMENTS, billId, { status: status.status, paidAt: status.paidAt });
}

async function listForPatient(patientId) {
  const store = getStore();
  return (await store.findAll(COLLECTIONS.PAYMENTS, (p) => p.patientId === patientId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const SUPPORTED_BENEFIT_KEYS = Object.keys(BENEFIT_RULES);

module.exports = { computeBenefits, createBill, refreshStatus, listForPatient, SUPPORTED_BENEFIT_KEYS };
