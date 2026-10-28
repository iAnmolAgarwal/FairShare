'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { CONTENT_SECURITY_POLICY } = require('../scripts/assets');

const config = require(path.join(__dirname, '..', 'vercel.json'));

function headersFor(source) {
  const rule = config.headers.find((entry) => entry.source === source);
  assert.ok(rule, 'vercel.json has a headers rule for ' + source);
  return Object.fromEntries(rule.headers.map((h) => [h.key, h.value]));
}

test('vercel.json deploys the static build in dist/', () => {
  assert.equal(config.buildCommand, 'npm run build');
  assert.equal(config.outputDirectory, 'dist');
});

test('vercel.json sends the dev server CSP plus frame-ancestors', () => {
  const csp = headersFor('/(.*)')['Content-Security-Policy'];
  assert.equal(csp, CONTENT_SECURITY_POLICY + "; frame-ancestors 'none'");
});

test('vercel.json sends nosniff and no-referrer like the dev server', () => {
  const all = headersFor('/(.*)');
  assert.equal(all['X-Content-Type-Options'], 'nosniff');
  assert.equal(all['Referrer-Policy'], 'no-referrer');
});
