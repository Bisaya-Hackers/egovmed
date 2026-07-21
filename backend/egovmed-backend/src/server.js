'use strict';
const app = require('./app');
const { env } = require('./config/env');
const logger = require('./lib/logger');

app.listen(env.port, () => {
  logger.info(`eGovMed backend listening on http://localhost:${env.port}`, { mode: env.globalMode });
});
