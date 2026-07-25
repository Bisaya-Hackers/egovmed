'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { requireAuth, rateLimit, validate, asyncHandler } = require('../middleware');
const { getStore, COLLECTIONS } = require('../store');
const auditService = require('../services/auditService');
const eMessage = require('../integrations/eMessage');
const { randomId } = require('../lib/crypto');
const { notFound } = require('../lib/errors');

const router = Router();
const requestMeta = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });
const strip = ({ id, kind, status, channel, provider, createdAt, meta }) => ({ id, kind, status, channel, provider, createdAt, meta });

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
      .map(strip);

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

// POST /messages/:id/reply  { text } → patient replies to a message thread.
// The reply text is forwarded to eMessage (mock) but NEVER persisted — same audit-hygiene rule
// as every other row in this collection. We also write a simulated staff acknowledgement so the
// thread reads as a live conversation instead of a one-way notification feed.
router.post(
  '/:id/reply',
  requireAuth,
  rateLimit({ scope: 'messages-reply', max: 20, windowMs: 10 * 60_000 }),
  validate(z.object({ id: z.string().regex(/^msg_[A-Za-z0-9_-]{1,100}$/) }).strict(), 'params'),
  validate(z.object({ text: z.string().trim().min(1).max(1000) }).strict()),
  asyncHandler(async (req, res) => {
    const store = getStore();
    const original = await store.findById(COLLECTIONS.MESSAGES, req.params.id);
    if (!original || original.patientId !== req.user.sub) throw notFound('Message not found');

    const outbound = await eMessage.send({
      to: 'pgh-patient-services', channel: 'in_app', subject: 'Patient reply', body: req.body.text,
    });
    const replyRow = {
      id: randomId('msg_'), patientId: req.user.sub, kind: 'reply_sent',
      status: outbound.status || 'sent', channel: 'in_app', provider: outbound.provider || 'mock',
      createdAt: new Date().toISOString(), meta: { inReplyTo: original.id },
    };
    await store.create(COLLECTIONS.MESSAGES, replyRow);

    const ackRow = {
      id: randomId('msg_'), patientId: req.user.sub, kind: 'staff_ack', status: 'received',
      channel: 'in_app', provider: 'mock', createdAt: new Date(Date.now() + 1200).toISOString(),
      meta: { inReplyTo: original.id },
    };
    await store.create(COLLECTIONS.MESSAGES, ackRow);

    await auditService.log({
      actorId: req.user.sub, patientId: req.user.sub, action: 'messages.reply',
      resourceType: 'message', resourceId: original.id, requestMeta: requestMeta(req),
    });

    res.status(201).json({ reply: strip(replyRow), ack: strip(ackRow) });
  }),
);

module.exports = router;
