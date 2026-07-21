'use strict';
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { unauthorized } = require('./errors');

function sign(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.sessionTtl });
}

function verify(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch (e) {
    throw unauthorized('Invalid or expired session token');
  }
}

module.exports = { sign, verify };
