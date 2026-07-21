'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, validate, asyncHandler } = require('../middleware');
const appointmentService = require('../services/appointmentService');

const router = Router();

// POST /appointments  { specialty, hospital?, scheduledFor?, triageId? }
router.post('/', requireAuth,
  validate(z.object({
    specialty: z.string(),
    hospital: z.string().optional(),
    scheduledFor: z.string().optional(),
    triageId: z.string().optional(),
  })),
  asyncHandler(async (req, res) => {
    res.status(201).json(await appointmentService.book({ patientId: req.user.sub, ...req.body }));
  }));

// GET /appointments → patient's appointments
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  res.json(await appointmentService.listForPatient(req.user.sub));
}));

// POST /appointments/:id/remind → send an eMessage reminder
router.post('/:id/remind', requireAuth, asyncHandler(async (req, res) => {
  res.json(await appointmentService.sendReminder(req.params.id));
}));

// PATCH /appointments/:id  { status }
router.patch('/:id', requireAuth,
  validate(z.object({ status: z.enum(['booked', 'checked-in', 'seen', 'cancelled', 'no-show']) })),
  asyncHandler(async (req, res) => {
    res.json(await appointmentService.updateStatus(req.params.id, req.body.status));
  }));

module.exports = router;
