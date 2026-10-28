'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(__dirname, '..', 'server.js');

let server;
let port;

test.before(() => {
  return new Promise((resolve) => {
    delete require.cache[require.resolve(SERVER_PATH)];
    server = require(SERVER_PATH);
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });
});

test.after(() => {
  if (server) server.close();
});

function request(method, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('GET / returns 200 with Cache-Control: no-cache', async () => {
  const res = await request('GET', '/');
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'no-cache');
});

test('GET /index.html returns 200 with Cache-Control: no-cache', async () => {
  const res = await request('GET', '/index.html');
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'no-cache');
});

test('GET /core.js (no query) returns 200 with Cache-Control: no-cache', async () => {
  const res = await request('GET', '/core.js');
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'no-cache');
});

test('GET /core.js?v= matches current content hash returns immutable', async () => {
  const home = await request('GET', '/');
  const m = home.body.match(/core\.js\?v=([0-9a-f]{16})/i);
  assert.ok(m, 'index.html contains a content hash');
  const hash = m[1];
  const res = await request('GET', '/core.js?v=' + hash);
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'public, max-age=31536000, immutable');
});

test('GET /app.js returns 200 with Content-Type text/javascript and no-cache', async () => {
  const res = await request('GET', '/app.js');
  assert.equal(res.status, 200);
  assert.ok(res.headers['content-type'].startsWith('text/javascript'));
  assert.equal(res.headers['cache-control'], 'no-cache');
});

test('GET /app.js?v= current hash returns immutable', async () => {
  const home = await request('GET', '/');
  const m = home.body.match(/app\.js\?v=([0-9a-f]{16})/i);
  assert.ok(m, 'index.html contains an app.js hash');
  const hash = m[1];
  const res = await request('GET', '/app.js?v=' + hash);
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'public, max-age=31536000, immutable');
});

test('GET /app.js?v=stale returns no-cache', async () => {
  const res = await request('GET', '/app.js?v=0000000000000000');
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'no-cache');
});

test('GET /styles.css returns 200 with Content-Type text/css and no-cache', async () => {
  const res = await request('GET', '/styles.css');
  assert.equal(res.status, 200);
  assert.ok(res.headers['content-type'].startsWith('text/css'));
  assert.equal(res.headers['cache-control'], 'no-cache');
});

test('GET /styles.css?v= current hash returns immutable', async () => {
  const home = await request('GET', '/');
  const m = home.body.match(/styles\.css\?v=([0-9a-f]{16})/i);
  assert.ok(m, 'index.html contains a styles.css hash');
  const hash = m[1];
  const res = await request('GET', '/styles.css?v=' + hash);
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'public, max-age=31536000, immutable');
});

test('GET /styles.css?v=stale returns no-cache', async () => {
  const res = await request('GET', '/styles.css?v=0000000000000000');
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'no-cache');
});

test('GET /core.js body matches the file on disk', async () => {
  const real = fs.readFileSync(path.join(__dirname, '..', 'core.js'));
  const res = await request('GET', '/core.js');
  assert.equal(res.body, real.toString('utf8'));
});

test('GET /app.js body matches the file on disk', async () => {
  const real = fs.readFileSync(path.join(__dirname, '..', 'app.js'));
  const res = await request('GET', '/app.js');
  assert.equal(res.body, real.toString('utf8'));
});

test('GET /styles.css body matches the file on disk', async () => {
  const real = fs.readFileSync(path.join(__dirname, '..', 'styles.css'));
  const res = await request('GET', '/styles.css');
  assert.equal(res.body, real.toString('utf8'));
});

test('GET /core.js, /app.js and /styles.css bodies all differ from each other', async () => {
  const [c, a, s] = await Promise.all([
    request('GET', '/core.js'),
    request('GET', '/app.js'),
    request('GET', '/styles.css')
  ]);
  assert.notEqual(c.body, a.body);
  assert.notEqual(a.body, s.body);
  assert.notEqual(c.body, s.body);
});

test('GET /styles.css body contains CSS content', async () => {
  const res = await request('GET', '/styles.css');
  assert.ok(res.body.includes(':root'));
  assert.ok(res.body.includes('--bg'));
});

test('GET /app.js body contains the load-failure guard', async () => {
  const res = await request('GET', '/app.js');
  assert.ok(res.body.includes('load-failure'));
  assert.ok(res.body.includes('typeof window.SplitSafarCore'));
});

test('tokens for core.js, app.js and styles.css all differ and are 16 hex chars', async () => {
  const home = await request('GET', '/');
  const coreM = home.body.match(/core\.js\?v=([0-9a-f]{16})/i);
  const appM = home.body.match(/app\.js\?v=([0-9a-f]{16})/i);
  const cssM = home.body.match(/styles\.css\?v=([0-9a-f]{16})/i);
  assert.ok(coreM, 'core.js token found');
  assert.ok(appM, 'app.js token found');
  assert.ok(cssM, 'styles.css token found');
  assert.notEqual(coreM[1], appM[1], 'core and app tokens differ');
  assert.notEqual(appM[1], cssM[1], 'app and css tokens differ');
  assert.notEqual(coreM[1], cssM[1], 'core and css tokens differ');
  assert.equal(coreM[1].length, 16, 'core token is 16 hex chars');
  assert.equal(appM[1].length, 16, 'app token is 16 hex chars');
  assert.equal(cssM[1].length, 16, 'css token is 16 hex chars');
});

test('GET /test/core.test.js returns 404 with no-store', async () => {
  const res = await request('GET', '/test/core.test.js');
  assert.equal(res.status, 404);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('GET /.env returns 404 with no-store', async () => {
  const res = await request('GET', '/.env');
  assert.equal(res.status, 404);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('GET /server.js returns 404 with no-store', async () => {
  const res = await request('GET', '/server.js');
  assert.equal(res.status, 404);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('POST / returns 405 with Allow header and no-store', async () => {
  const res = await request('POST', '/');
  assert.equal(res.status, 405);
  assert.equal(res.headers['allow'], 'GET, HEAD');
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('GET /core.js?v=0.0.1 (mismatched version) returns no-cache', async () => {
  const res = await request('GET', '/core.js?v=0.0.1');
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'no-cache');
});

test('GET /missing returns 404 with no-store', async () => {
  const res = await request('GET', '/missing');
  assert.equal(res.status, 404);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('all responses include security headers', async () => {
  const res = await request('GET', '/');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['referrer-policy'], 'no-referrer');
});

test('HTML responses include the Content-Security-Policy header', async () => {
  const res = await request('GET', '/');
  const csp = res.headers['content-security-policy'];
  assert.ok(csp, 'CSP header present');
  assert.ok(csp.includes("default-src 'self'"), 'default-src self');
  assert.ok(csp.includes("script-src 'self'"), 'script-src self');
  assert.ok(csp.includes("style-src 'self'"), 'style-src self');
  assert.ok(csp.includes("img-src 'self' data: blob:"), 'img-src');
  assert.ok(csp.includes("connect-src 'self'"), 'connect-src self');
  assert.ok(csp.includes("object-src 'none'"), 'object-src none');
  assert.ok(csp.includes("base-uri 'none'"), 'base-uri none');
  assert.ok(csp.includes("form-action 'self'"), 'form-action self');
  assert.ok(!csp.includes('frame-ancestors'), 'no frame-ancestors');
});

test('index.html contains no inline event handler attributes', async () => {
  const res = await request('GET', '/');
  // Check no on* attributes exist in the served HTML
  const bad = res.body.match(/\son\w+=['"]/gi);
  if (bad) {
    assert.fail('found inline handler(s): ' + bad.join(', '));
  }
});

test('index.html contains no style attributes', async () => {
  const res = await request('GET', '/');
  const bad = res.body.match(/\sstyle=/gi);
  if (bad) {
    assert.fail('found inline style(s): ' + bad.join(', '));
  }
});

test('styles.css starts with :root{ and contains no stray prompt text', async () => {
  const res = await request('GET', '/styles.css');
  assert.ok(res.body.startsWith(':root{') || res.body.startsWith(':root {'), 'styles.css starts with :root{ or :root {');
  assert.ok(!res.body.includes('Context:'), 'styles.css has no stray Context: text');
});

test('index.html has no duplicate ids', async () => {
  const res = await request('GET', '/');
  const ids = [];
  res.body.replace(/id="([^"]+)"/g, function (m, id) { ids.push(id); });
  const dups = ids.filter(function (id, i) { return ids.indexOf(id) !== i; });
  if (dups.length > 0) {
    assert.fail('duplicate ids: ' + [...new Set(dups)].join(', '));
  }
});

test('index.html every label for= references an existing id', async () => {
  const res = await request('GET', '/');
  const idSet = new Set();
  res.body.replace(/id="([^"]+)"/g, function (m, id) { idSet.add(id); });
  const bad = [];
  res.body.replace(/<label[^>]*for="([^"]+)"/g, function (m, forId) {
    if (!idSet.has(forId)) bad.push(forId);
  });
  if (bad.length > 0) {
    assert.fail('label for references missing id: ' + bad.join(', '));
  }
});

test('missing asset returns 503 and server keeps running', async () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'splitsafar-test-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(tmpDir, 'core.js'), '// core');
    // Intentionally do NOT write app.js or styles.css

    process.env.SPLITSAFAR_ROOT = tmpDir;
    delete require.cache[require.resolve(SERVER_PATH)];
    const srv = require(SERVER_PATH);
    await new Promise((resolve) => { srv.listen(0, '127.0.0.1', resolve); });
    const p = srv.address().port;

    function get(u) {
      return new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port: p, path: u }, (res) => {
          let body = '';
          res.on('data', (c) => body += c);
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
        }).on('error', reject);
      });
    }

    const app = await get('/app.js');
    assert.equal(app.status, 503);
    assert.equal(app.headers['cache-control'], 'no-store');

    const core = await get('/core.js');
    assert.equal(core.status, 200);

    const root = await get('/');
    assert.equal(root.status, 503);

    srv.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});