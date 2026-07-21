'use strict';
const { Router } = require('express');
const { requireAuth, asyncHandler } = require('../middleware');
const { getStore, COLLECTIONS } = require('../store');
const { notFound } = require('../lib/errors');

const router = Router();

// Whitelist the fields the client needs — never auto-expose the whole stored doc
// (keeps philsysId and benefit member IDs off the wire; masks sensitive identifiers).
const publicPatient = (p) => ({
  id: p.id,
  firstName: p.firstName,
  middleName: p.middleName,
  lastName: p.lastName,
  suffix: p.suffix,
  sex: p.sex,
  birthDate: p.birthDate,
  email: p.email,
  phone: p.phone,
  nationality: p.nationality,
  identityVerified: !!p.identityVerified,
  benefits: {
    philhealth: !!p.benefits?.philhealth?.active,
    whiteCard: !!p.benefits?.whiteCard?.active,
    sss: !!p.benefits?.sss?.active,
  },
});

// GET /patients/me → the authenticated patient's profile
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const store = getStore();
  const patient = await store.findById(COLLECTIONS.PATIENTS, req.user.sub);
  if (!patient) throw notFound('Patient not found');
  res.json(publicPatient(patient));
}));

module.exports = router;
