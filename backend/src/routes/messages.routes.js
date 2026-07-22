'use strict';
const { Router } = require('express');
const { requireAuth, rateLimit, asyncHandler } = require('../middleware');
const { getStore, COLLECTIONS } = require('../store');
const auditService = require('../services/auditService');

const router = Router();
const requestMeta = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

router.get(
  '/',
  requireAuth,
  rateLimit({ scope: 'messages-list', max: 60, windowMs: 60_000 }),
  asyncHandler(async (req, res) => {
    const rows = await getStore().findAll(
      COLLECTIONS.MESSAGES,
      (message) => message.patientId === req.user.sub,
    );
    const messages = rows
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .map(({ id, kind, status, channel, provider, createdAt }) => ({
        id, kind, status, channel, provider, createdAt,
      }));

    await auditService.log({
      actorId: req.user.sub,
      patientId: req.user.sub,
      action: 'messages.list',
      resourceType: 'message',
      requestMeta: requestMeta(req),
    });
    res.json(messages);
  }),
);

module.exports = router;
