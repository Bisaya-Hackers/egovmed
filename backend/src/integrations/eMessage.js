'use strict';
const { env } = require('../config/env');
const http = require('../lib/http');
const logger = require('../lib/logger');
const { randomId } = require('../lib/crypto');

const cfg = env.eMessage;

/** channel: 'sms' | 'email' | 'inapp' */
async function send({ to, channel = 'sms', subject, body }) {
  if (cfg.mode === 'live' && cfg.apiKey) {
    // NOTE: confirm payload with eMessage docs.
    const res = await http.post(`${cfg.baseUrl}/v1/messages`, {
      sender_id: cfg.senderId, to, channel, subject, body,
    }, { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
    return { id: res.message_id || randomId('msg_'), status: res.status || 'sent', channel, to, provider: 'emessage' };
  }
  logger.info('eMessage mock send', { to, channel, subject });
  return { id: randomId('msg_'), status: 'sent', channel, to, provider: 'mock', body };
}

module.exports = { send };
