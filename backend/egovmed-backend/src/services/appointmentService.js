'use strict';
const eMessage = require('../integrations/eMessage');
const { getStore, COLLECTIONS } = require('../store');
const { randomId } = require('../lib/crypto');
const { notFound } = require('../lib/errors');

async function book({ patientId, specialty, hospital = 'PGH', scheduledFor, triageId }) {
  const store = getStore();
  const patient = await store.findById(COLLECTIONS.PATIENTS, patientId);
  if (!patient) throw notFound('Patient not found');

  const existing = await store.findAll(COLLECTIONS.APPOINTMENTS, (a) => a.hospital === hospital && a.specialty === specialty);
  const queueNumber = existing.length + 1;

  const appt = {
    id: randomId('apt_'),
    patientId,
    specialty,
    hospital,
    scheduledFor: scheduledFor || null,
    triageId: triageId || null,
    queueNumber,
    status: 'booked',
    createdAt: new Date().toISOString(),
  };
  await store.create(COLLECTIONS.APPOINTMENTS, appt);

  // Send confirmation to the verified contact.
  let notification = null;
  if (patient.phone || patient.email) {
    notification = await eMessage.send({
      to: patient.phone || patient.email,
      channel: patient.phone ? 'sms' : 'email',
      subject: 'eGovMed appointment confirmed',
      body: `Hi ${patient.firstName}, your ${specialty} appointment at ${hospital} is booked. Queue #${queueNumber}.`,
    });
    await store.create(COLLECTIONS.MESSAGES, { id: notification.id, patientId, kind: 'confirmation', ...notification, createdAt: new Date().toISOString() });
  }

  return { appointment: appt, notification };
}

async function listForPatient(patientId) {
  const store = getStore();
  return (await store.findAll(COLLECTIONS.APPOINTMENTS, (a) => a.patientId === patientId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function sendReminder(appointmentId) {
  const store = getStore();
  const appt = await store.findById(COLLECTIONS.APPOINTMENTS, appointmentId);
  if (!appt) throw notFound('Appointment not found');
  const patient = await store.findById(COLLECTIONS.PATIENTS, appt.patientId);
  const notification = await eMessage.send({
    to: patient.phone || patient.email,
    channel: patient.phone ? 'sms' : 'email',
    subject: 'Appointment reminder',
    body: `Reminder: your ${appt.specialty} appointment at ${appt.hospital}. Queue #${appt.queueNumber}.`,
  });
  return notification;
}

async function updateStatus(appointmentId, status) {
  const store = getStore();
  const appt = await store.update(COLLECTIONS.APPOINTMENTS, appointmentId, { status });
  if (!appt) throw notFound('Appointment not found');
  return appt;
}

module.exports = { book, listForPatient, sendReminder, updateStatus };
