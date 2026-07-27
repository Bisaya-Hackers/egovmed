'use strict';
const crypto = require('crypto');
const { env, publicUrl } = require('../config/env');
const http = require('../lib/http');
const { randomId } = require('../lib/crypto');

const cfg = env.egovPay;
const isLive = () => cfg.mode === 'live';

// digest = HMAC-SHA256("amount|txnid", secret)  — binds amount+txnid to the merchant token.
// The mode-prefix (`test_` / `live_`) on the API token is NOT part of the HMAC key; the eGovPay
// sandbox rejects the digest otherwise (unprocessable_entity "The digest is not valid.").
const hmacKey = () => String(cfg.token || '').replace(/^(test_|live_)/, '');
const digestFor = (amount, txnid) => crypto.createHmac('sha256', hmacKey()).update(`${amount}|${txnid}`).digest('hex');
const normalizePaymentStatus = (data = {}) => {
  const value = data.payment_status ?? data.status ?? data.state;
  return value == null || String(value).trim() === '' ? 'pending' : String(value).trim().toLowerCase();
};

// Mock mode used to hardcode every checkout as 'paid', which meant the failed-payment UI could
// never actually be exercised in local/demo testing (no eGov credentials required, per the
// backend README). EGOVPAY_MOCK_OUTCOME lets a developer force a specific terminal status while
// testing; anything unrecognized falls back to the original always-succeeds demo behavior.
const MOCK_TERMINAL_STATUSES = new Set(['paid', 'failed', 'voided', 'cancelled', 'declined']);
const mockFinalStatus = () => (MOCK_TERMINAL_STATUSES.has(cfg.mockOutcome) ? cfg.mockOutcome : 'paid');

/**
 * Create a payment transaction and return a hosted payment-gateway link.
 * live: POST {baseUrl}/api/v1/transaction with X-eGovPay-Token + digest.
 * mock: returns a fake checkout URL + reference (demo).
 */
async function createCheckout({ amount, currency = 'PHP', description, items = [], mobile, email, name }) {
  if (isLive()) {
    if (!cfg.token || !cfg.settlementTemplateUuid) throw new Error('eGovPay live mode requires token and settlement template');
    const redirectUrl = cfg.redirectUrl || publicUrl(env.appUrl, '/payment/return');
    const callbackUrl = cfg.callbackUrl || publicUrl(env.apiPublicUrl, '/payments/callback');
    if (!/^https:\/\//i.test(redirectUrl) || !/^https:\/\//i.test(callbackUrl)) {
      throw new Error('eGovPay live mode requires HTTPS redirect and callback URLs');
    }
    const txnid = randomId('txn_');
    const body = {
      items: items.length ? items : [{ name: description || 'Hospital services', amount }],
      amount,
      settlement_template_uuid: cfg.settlementTemplateUuid,
      redirect_url: redirectUrl,
      callback_url: callbackUrl,
      txnid,
      digest: digestFor(amount, txnid),
      currency,
      mobile,
      email,
      name,
      // The partner schema defines description as an object. Keep it generic so
      // medical details and patient identifiers never leave through the payment API.
      description: { purpose: description || 'Hospital services' },
    };
    const res = await http.post(`${cfg.baseUrl}/api/v1/transaction`, body, {
      headers: { 'X-eGovPay-Token': cfg.token, 'Content-Type': 'application/json; charset=utf-8' },
    });
    const data = (res && (res.data || res)) || {};
    return {
      reference: data.uuid || data.transaction_uuid || txnid,
      checkoutUrl: data.url || data.payment_url || data.checkout_url || data.link,
      status: normalizePaymentStatus(data),
      provider: 'egovpay',
    };
  }
  const ref = randomId('pay_');
  return {
    reference: ref,
    checkoutUrl: `${env.appUrl}/mock-checkout/${ref}?amount=${amount}`,
    // A fully-covered bill (amount 0) needs no gateway charge and settles immediately regardless
    // of the configured mock outcome. Otherwise defer to mockFinalStatus() so a forced failure
    // (EGOVPAY_MOCK_OUTCOME=failed) is reflected consistently from creation through status checks.
    status: amount <= 0 ? 'paid' : mockFinalStatus(),
    provider: 'mock',
  };
}

async function getStatus(reference) {
  if (isLive()) {
    if (!cfg.token) throw new Error('eGovPay live mode requires EGOVPAY_TOKEN');
    const res = await http.get(`${cfg.baseUrl}/api/v1/transaction/${encodeURIComponent(reference)}`, {
      headers: { 'X-eGovPay-Token': cfg.token, 'Content-Type': 'application/json; charset=utf-8' },
    });
    const data = (res && (res.data || res)) || {};
    return {
      reference,
      status: normalizePaymentStatus(data),
      paidAt: data.paid_at || data.settled_at || data.completed_at,
      provider: 'egovpay',
    };
  }
  const status = mockFinalStatus();
  return { reference, status, paidAt: status === 'paid' ? new Date().toISOString() : null, provider: 'mock' };
}

module.exports = { createCheckout, getStatus, normalizePaymentStatus };
