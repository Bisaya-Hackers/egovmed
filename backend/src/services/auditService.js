'use strict';
const { getStore, COLLECTIONS } = require('../store');
const { randomId } = require('../lib/crypto');

/** Append a PHI-access audit event without recording clinical content or credentials. */
async function log({ actorId, patientId, action, resourceType, resourceId = null, requestMeta = {} }) {
  return getStore().create(COLLECTIONS.AUDIT_LOGS, {
    id: randomId('aud_'),
    actorId,
    patientId,
    action,
    resourceType,
    resourceId,
    ip: requestMeta.ip || null,
    userAgent: String(requestMeta.userAgent || '').slice(0, 500) || null,
    createdAt: new Date().toISOString(),
  });
}

module.exports = { log };
