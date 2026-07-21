'use strict';
const { Router } = require('express');
const { env } = require('../config/env');
const { getStore } = require('../store');

const router = Router();

// Health + service info
router.get('/', (_req, res) => {
  res.json({
    service: 'eGovMed backend',
    version: '0.1.0',
    status: 'ok',
    store: getStore().driver,
    integrationMode: env.globalMode,
    docs: '/health, /auth, /patients, /triage, /identity, /records, /appointments, /payments, /reports',
  });
});

router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

router.use('/auth', require('./auth.routes'));
router.use('/patients', require('./patients.routes'));
router.use('/triage', require('./triage.routes'));
router.use('/identity', require('./identity.routes'));
router.use('/records', require('./records.routes'));
router.use('/appointments', require('./appointments.routes'));
router.use('/payments', require('./payments.routes'));
router.use('/reports', require('./reports.routes'));

module.exports = router;
