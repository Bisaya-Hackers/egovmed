'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, validate, asyncHandler } = require('../middleware');
const paymentService = require('../services/paymentService');
const { getStore, COLLECTIONS } = require('../store');

const router = Router();

// POST /payments/quote  { billAmount } → preview benefits without creating a bill
router.post('/quote', requireAuth,
  validate(z.object({ billAmount: z.number().positive() })),
  asyncHandler(async (req, res) => {
    const store = getStore();
    const patient = await store.findById(COLLECTIONS.PATIENTS, req.user.sub);
    res.json(paymentService.computeBenefits(req.body.billAmount, patient?.benefits));
  }));

// POST /payments  { billAmount, description?, channel? } → create bill + eGovPay checkout
router.post('/', requireAuth,
  validate(z.object({
    billAmount: z.number().positive(),
    description: z.string().optional(),
    channel: z.string().optional(),
  })),
  asyncHandler(async (req, res) => {
    res.status(201).json(await paymentService.createBill({ patientId: req.user.sub, ...req.body }));
  }));

// GET /payments → patient's bills
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  res.json(await paymentService.listForPatient(req.user.sub));
}));

// GET /payments/:id/status → refresh checkout status
router.get('/:id/status', requireAuth, asyncHandler(async (req, res) => {
  res.json(await paymentService.refreshStatus(req.params.id));
}));

module.exports = router;
