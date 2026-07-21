'use strict';
const egovPay = require('../integrations/egovPay');
const { getStore, COLLECTIONS } = require('../store');
const { randomId } = require('../lib/crypto');
const { notFound } = require('../lib/errors');

// Simplified, transparent benefit rules for the demo. Real coverage comes from the payer APIs.
const BENEFIT_RULES = {
  philhealth: { label: 'PhilHealth', rate: 0.6 }, // covers up to 60% of the demo bill
  whiteCard: { label: 'White Card (indigent)', rate: 1.0 }, // full coverage at public hospitals
  sss: { label: 'SSS', rate: 0.2 },
};

const round2 = (n) => Math.round(n * 100) / 100;

function computeBenefits(billAmount, benefits = {}) {
  // `source: 'mock'` + disclaimer are returned on the wire so the client/judges never mistake
  // these for a live PhilHealth/SSS/White Card determination.
  const mockMeta = { source: 'mock', disclaimer: 'Estimated benefits — not a live PhilHealth/SSS/White Card determination.' };
  if (!Number.isFinite(billAmount) || billAmount <= 0) return { applied: [], coveredTotal: 0, balance: 0, ...mockMeta };

  let remaining = billAmount;
  const applied = [];
  // Apply white card first (can fully cover), then PhilHealth, then SSS.
  for (const key of ['whiteCard', 'philhealth', 'sss']) {
    if (remaining <= 0) break;
    if (benefits[key]?.active) {
      const covered = round2(Math.min(remaining, billAmount * BENEFIT_RULES[key].rate));
      if (covered > 0) {
        applied.push({ program: key, label: BENEFIT_RULES[key].label, amount: covered, mock: true });
        remaining = round2(remaining - covered);
      }
    }
  }
  return { applied, coveredTotal: round2(billAmount - remaining), balance: Math.max(0, round2(remaining)), ...mockMeta };
}

async function createBill({ patientId, billAmount, description = 'Hospital services', channel = 'any' }) {
  const store = getStore();
  const patient = await store.findById(COLLECTIONS.PATIENTS, patientId);
  if (!patient) throw notFound('Patient not found');

  const { applied, coveredTotal, balance } = computeBenefits(billAmount, patient.benefits);
  const checkout = await egovPay.createCheckout({
    amount: balance, description, channel,
  });

  const payment = {
    id: randomId('bill_'),
    patientId,
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

module.exports = { computeBenefits, createBill, refreshStatus, listForPatient };
