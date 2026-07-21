'use strict';
const { env } = require('../config/env');
const http = require('../lib/http');
const logger = require('../lib/logger');
const { randomId } = require('../lib/crypto');

const cfg = env.eMessage;

/** channel: 'sms' | 'email' | 'inapp'. The documented eMessage API covers SMS push. */
async function send({ to, channel = 'sms', subject, body }) {
  if (cfg.mode === 'live' && cfg.authToken && channel === 'sms') {
    // per apidocumentation/eMessage-API.md — POST /messaging/v1/sms/push { number, message }
    const res = await http.post(`${cfg.baseUrl}/messaging/v1/sms/push`, {
      number: to, message: body,
    }, { headers: { 'X-EMESSAGE-Auth': cfg.authToken, 'Content-Type': 'application/json' } });
    const data = (res && (res.data || res)) || {};
    return { id: randomId('msg_'), status: data.message ? 'created' : 'sent', channel: 'sms', to, provider: 'emessage' };
  }
  // mock (and non-SMS channels, which the documented hackathon API doesn't cover)
  logger.info('eMessage mock send', { to, channel, subject });
  return { id: randomId('msg_'), status: 'sent', channel, to, provider: 'mock', body };
}

module.exports = { send };
