'use strict';
// Vercel routes every request here (see vercel.json rewrites).
// Express apps are (req, res) handlers, so exporting the app works as a serverless function.
const app = require('../src/app');
module.exports = app;
