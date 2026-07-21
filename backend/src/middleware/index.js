'use strict';
const { verify } = require('../lib/jwt');
const { AppError, unauthorized, forbidden, badRequest } = require('../lib/errors');
const { env } = require('../config/env');
const logger = require('../lib/logger');

/** Attaches req.user from the Bearer session JWT, else 401. Header-only (never from the query string — avoids token leakage into logs). */
function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(unauthorized('Missing session token'));
  try {
    req.user = verify(token);
    next();
  } catch (e) {
    next(e);
  }
}

/**
 * Gate for operational/admin routes (escalation sweeps, cross-tenant insights).
 * Requires an `x-admin-key` header matching ADMIN_KEY. Denies if ADMIN_KEY is unset.
 */
function requireAdmin(req, _res, next) {
  if (!env.adminKey || req.headers['x-admin-key'] !== env.adminKey) {
    return next(forbidden('Admin access required'));
  }
  next();
}

/** Validates req[source] against a zod schema and replaces it with the parsed value. */
const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return next(badRequest('Validation failed', result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
  }
  req[source] = result.data;
  next();
};

/** Wrap async handlers so thrown errors reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, _next) {
  const status = err instanceof AppError ? err.status : 500;
  if (status >= 500) logger.error('unhandled error', { path: req.path, err: err.message, stack: err.stack });
  res.status(status).json({
    error: {
      code: err.code || 'internal_error',
      message: status >= 500 && env.isProd ? 'Internal server error' : err.message,
      details: err.details,
    },
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });
}

module.exports = { requireAuth, requireAdmin, validate, asyncHandler, errorHandler, notFoundHandler };
