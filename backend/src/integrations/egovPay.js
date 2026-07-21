'use strict';
const crypto = require('crypto');
const { env } = require('../config/env');
const http = require('../lib/http');
const { randomId } = require('../lib/crypto');

const cfg = env.egovPay;
const isLive = () => cfg.mode === 'live' && cfg.token;

// digest = HMAC-SHA256("amount|txnid", token)  — binds amount+txnid to the merchant token (per eGovPay docs).
const digestFor = (amount, txnid) => crypto.createHmac('sha256', cfg.token).update(`${amount}|${txnid}`).digest('hex');

/**
 * Create a payment transaction and return a hosted payment-gateway link.
 * live: POST {baseUrl}/api/v1/transaction with X-eGovPay-Token + digest.
 * mock: returns a fake checkout URL + reference (demo).
 */
async function createCheckout({ patientId, amount, currency = 'PHP', description, items = [], mobile, email, name, metadata = {} }) {
  if (isLive()) {
    const txnid = randomId('txn_');
    const body = {
      items: items.length ? items : [{ name: description || 'Hospital services', amount }],
      amount,
      settlement_template_uuid: cfg.settlementTemplateUuid,
      redirect_url: cfg.redirectUrl,
      callback_url: cfg.callbackUrl,
      txnid,
      digest: digestFor(amount, txnid),
      currency,
      mobile,
      email,
      name,
      description: { patientId, ...metadata },
    };
    const res = await http.post(`${cfg.baseUrl}/api/v1/transaction`, body, {
      headers: { 'X-eGovPay-Token': cfg.token, 'Content-Type': 'application/json; charset=utf-8' },
    });
    const data = (res && (res.data || res)) || {};
    return {
      reference: data.uuid || data.transaction_uuid || txnid,
      checkoutUrl: data.payment_url || data.checkout_url || data.link,
      status: data.status || 'pending',
      provider: 'egovpay',
    };
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
  if (isLive()) {
    const res = await http.get(`${cfg.baseUrl}/api/v1/transaction/${reference}`, {
      headers: { 'X-eGovPay-Token': cfg.token, 'Content-Type': 'application/json; charset=utf-8' },
    });
    const data = (res && (res.data || res)) || {};
    return { reference, status: data.status, paidAt: data.paid_at || data.settled_at, provider: 'egovpay' };
  }
  return { reference, status: 'paid', paidAt: new Date().toISOString(), provider: 'mock' };
}

module.exports = { createCheckout, getStatus };
