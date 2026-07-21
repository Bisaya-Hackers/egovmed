'use strict';
const { env } = require('../config/env');
const http = require('../lib/http');
const { randomId } = require('../lib/crypto');

const cfg = env.egovPay;

/**
 * Create a checkout for a bill after benefits have been applied by paymentService.
 * live: calls eGovPay to open a hosted checkout session.
 * mock: returns a fake checkout URL + reference (demo scope = mock checkout).
 */
async function createCheckout({ patientId, amount, currency = 'PHP', description, channel = 'any', metadata = {} }) {
  if (cfg.mode === 'live' && cfg.apiKey) {
    // NOTE: confirm payload with eGovPay docs.
    const res = await http.post(`${cfg.baseUrl}/v1/checkouts`, {
      merchant_id: cfg.merchantId, amount, currency, description, channel, metadata: { patientId, ...metadata },
    }, { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
    return { reference: res.reference, checkoutUrl: res.checkout_url, status: res.status || 'pending', provider: 'egovpay' };
  }
  const ref = randomId('pay_');
  return {
    reference: ref,
    checkoutUrl: `${env.appUrl}/mock-checkout/${ref}?amount=${amount}`,
    status: amount <= 0 ? 'paid' : 'pending',
    provider: 'mock',
  };
}

async function getStatus(reference) {
  if (cfg.mode === 'live' && cfg.apiKey) {
    const res = await http.get(`${cfg.baseUrl}/v1/checkouts/${reference}`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
    });
    return { reference, status: res.status, paidAt: res.paid_at, provider: 'egovpay' };
  }
  return { reference, status: 'paid', paidAt: new Date().toISOString(), provider: 'mock' };
}

module.exports = { createCheckout, getStatus };
