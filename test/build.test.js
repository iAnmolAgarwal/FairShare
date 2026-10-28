'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { build } = require('../scripts/build.js');

const ROOT = path.join(__dirname, '..');
const ASSETS = ['core.js', 'app.js', 'styles.css'];

function expectedHash(file) {
  const data = fs.readFileSync(path.join(ROOT, file));
  return crypto.createHash('sha256').update(file).update(data).digest('hex').substring(0, 16);
}

test('build writes a static dist with hashed asset URLs and a CSP meta tag', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fairshare-build-'));
  try {
    build(outDir);
    assert.deepEqual(fs.readdirSync(outDir).sort(), ['app.js', 'core.js', 'index.html', 'styles.css']);
    for (const file of ASSETS) {
      assert.ok(fs.readFileSync(path.join(outDir, file)).equals(fs.readFileSync(path.join(ROOT, file))), file + ' copied as is');
    }
    const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
    // A real hash may itself start with 0, so only a bare ?v=0 is the placeholder.
    assert.doesNotMatch(html, /\?v=0(?![0-9a-f])/, 'no placeholder version left');
    for (const file of ASSETS) {
      const refs = html.match(new RegExp(file.replace('.', '\\.') + '\\?v=([0-9a-f]{16})', 'g')) || [];
      assert.equal(refs.length, 1, file + ' referenced once');
      assert.equal(refs[0], file + '?v=' + expectedHash(file), file + ' hash matches its contents');
    }
    assert.match(html, /(href|src)="(styles\.css|core\.js|app\.js)\?v=/, 'asset URLs stay relative');
    assert.doesNotMatch(html, /(href|src)="\//, 'no root-absolute URLs, so a sub-path works');
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html);
    assert.ok(csp, 'CSP meta present');
    assert.ok(html.indexOf(csp[0]) < html.indexOf('<link rel="stylesheet"'), 'CSP meta precedes the assets');
    assert.match(csp[1], /default-src 'self'; script-src 'self'; style-src 'self'/);
    assert.match(csp[1], /object-src 'none'; base-uri 'none'; form-action 'self'/);
    assert.doesNotMatch(csp[1], /frame-ancestors|report-uri|sandbox/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('meta CSP drops directives that only work as a header', () => {
  const assets = require('../scripts/assets.js');
  assert.equal(assets.metaContentSecurityPolicy(), assets.CONTENT_SECURITY_POLICY, 'app header has none of them');
  assert.equal(
    assets.metaContentSecurityPolicy("default-src 'self'; frame-ancestors 'none'; report-uri /csp; sandbox allow-scripts; base-uri 'none'"),
    "default-src 'self'; base-uri 'none'"
  );
});
