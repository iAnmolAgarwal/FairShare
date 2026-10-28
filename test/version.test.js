'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SERVER_PATH = path.join(__dirname, '..', 'server.js');
const SOURCE_CORE = path.join(__dirname, '..', 'core.js');

function findHash(html) {
  const m = html.match(/core\.js\?v=([0-9a-f]{16})/i);
  return m ? m[1] : null;
}

test('content hash changes when core.js is modified without restart', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'splitsafar-hash-'));
  try {
    for (const file of ['index.html', 'core.js', 'app.js', 'styles.css']) {
      fs.copyFileSync(path.join(__dirname, '..', file), path.join(tmpDir, file));
    }
    process.env.SPLITSAFAR_ROOT = tmpDir;
    delete require.cache[require.resolve(SERVER_PATH)];
    const server = require(SERVER_PATH);
    await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
    const port = server.address().port;
    const req = (u) => new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path: u }, (res) => {
        let body = '';
        res.on('data', (c) => body += c);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }).on('error', reject);
    });
    const html1 = await req('/');
    const hash1 = findHash(html1.body);
    assert.ok(hash1, 'initial HTML contains a core.js hash');
    assert.ok(/app\.js\?v=([0-9a-f]{16})/.exec(html1.body), 'HTML contains an app.js hash');
    assert.ok(/styles\.css\?v=([0-9a-f]{16})/.exec(html1.body), 'HTML contains a styles.css hash');
    let r = await req('/core.js?v=' + hash1);
    assert.equal(r.headers['cache-control'], 'public, max-age=31536000, immutable');
    r = await req('/core.js?v=0000000000000000');
    assert.equal(r.headers['cache-control'], 'no-cache');
    const modified = '// ' + Date.now() + '\n' + fs.readFileSync(SOURCE_CORE, 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'core.js'), modified);
    r = await req('/core.js?v=' + hash1);
    assert.equal(r.headers['cache-control'], 'no-cache', 'old hash after modification returns no-cache (ordering)');
    assert.ok(r.body.startsWith('// '), 'old hash after modification returns new content');

    const html2 = await req('/');
    const hash2 = findHash(html2.body);
    assert.ok(hash2, 'second HTML contains a core.js hash');
    assert.ok(/app\.js\?v=([0-9a-f]{16})/.exec(html2.body), 'second HTML contains an app.js hash');
    assert.ok(/styles\.css\?v=([0-9a-f]{16})/.exec(html2.body), 'second HTML contains a styles.css hash');
    assert.notEqual(hash2, hash1, 'hash changed after file modification');
    r = await req('/core.js?v=' + hash2);
    assert.equal(r.headers['cache-control'], 'public, max-age=31536000, immutable');
    r = await req('/core.js?v=' + hash1);
    assert.equal(r.headers['cache-control'], 'no-cache');
    r = await req('/core.js');
    assert.equal(r.headers['cache-control'], 'no-cache');
    server.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});