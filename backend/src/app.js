'use strict';
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { env, warnIfMisconfigured } = require('./config/env');
const logger = require('./lib/logger');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware');

warnIfMisconfigured(logger);

const app = express();

// Never pair a reflected/wildcard origin with credentials (that lets any site make credentialed calls).
const corsOrigin = env.appUrl === '*' ? true : env.appUrl.split(',').map((s) => s.trim());
app.use(cors({ origin: corsOrigin, credentials: corsOrigin !== true }));
app.use(express.json({ limit: '2mb' }));
if (!env.isProd) app.use(morgan('dev'));

app.use('/', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
