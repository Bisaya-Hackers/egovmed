'use strict';
const { upstream } = require('./errors');
const logger = require('./logger');

/**
 * Thin fetch wrapper for calling eGov APIs.
 * - JSON in / JSON out by default
 * - request timeout via AbortController
 * - normalizes non-2xx into an AppError (502) with the upstream body attached
 *
 * SSRF invariant (defense in depth against CodeQL js/request-forgery pattern):
 * every call site MUST pass an https:// URL whose HOST comes from env config
 * (env.<integration>.baseUrl or rpcUrl), never from request input. Path segments
 * may include values from our own store or encodeURIComponent'd request data —
 * even a hostile path stays on the same host per RFC 3986 URL resolution.
 * The assertion below fails-closed at the transport rather than trusting every
 * caller to keep the invariant intact after a future refactor.
 */
async function request(url, { method = 'GET', headers = {}, body, timeoutMs = 15000, raw = false } = {}) {
  // Reject non-https and file:// / http:// / gopher:// / any URL parser can accept.
  // In dev the RPC/mock endpoints are http://localhost; allow http on loopback only.
  let parsed;
  try { parsed = new URL(url); } catch { throw upstream(`Refusing request to malformed URL: ${url}`); }
  const isLoopback = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopback)) {
    throw upstream(`Refusing non-https outbound request: ${parsed.protocol}//${parsed.hostname}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const opts = { method, headers: { Accept: 'application/json', ...headers }, signal: controller.signal };
  if (body !== undefined) {
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      opts.body = body;
    } else {
      opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
      opts.body = JSON.stringify(body);
    }
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    clearTimeout(timer);
    logger.error('http request failed', { url, method, err: err.message });
    throw upstream(`Request to ${url} failed: ${err.message}`);
  }
  clearTimeout(timer);

  const text = await res.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep raw text */ }

  if (!res.ok) {
    logger.warn('http upstream non-2xx', { url, method, status: res.status });
    throw upstream(`Upstream ${res.status} from ${url}`, data);
  }
  return raw ? { status: res.status, headers: res.headers, data } : data;
}

const get = (url, opts) => request(url, { ...opts, method: 'GET' });
const post = (url, body, opts) => request(url, { ...opts, method: 'POST', body });

module.exports = { request, get, post };
