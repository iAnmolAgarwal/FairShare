"use strict";

// Static build: writes dist/ with index.html, core.js, app.js and styles.css, which
// is what Vercel serves. Asset URLs stay relative, so dist/ also works from a sub-path.
// The CSP is also embedded as a <meta> tag, so the page stays protected on hosts that
// cannot send headers; vercel.json sends the full policy as a header.

const fs = require("fs");
const path = require("path");
const { ASSET_FILES, contentHash, stampAssetUrls, metaContentSecurityPolicy } = require("./assets");

const ROOT = path.join(__dirname, "..");
const DEFAULT_OUT_DIR = path.join(ROOT, "dist");
const CHARSET_META = '<meta charset="utf-8">';

function renderIndex(html, hashes) {
  for (const file of ASSET_FILES) {
    if (!html.includes(file + "?v=0")) {
      throw new Error("index.html has no " + file + "?v=0 reference to stamp");
    }
  }
  if (!html.includes(CHARSET_META)) {
    throw new Error("index.html has no " + CHARSET_META + " to place the CSP after");
  }
  const cspMeta =
    '<meta http-equiv="Content-Security-Policy" content="' + metaContentSecurityPolicy() + '">';
  return stampAssetUrls(html, (file) => hashes[file]).replace(CHARSET_META, CHARSET_META + "\n" + cspMeta);
}

function build(outDir) {
  const target = outDir || DEFAULT_OUT_DIR;
  const hashes = {};
  const assets = {};
  for (const file of ASSET_FILES) {
    assets[file] = fs.readFileSync(path.join(ROOT, file));
    hashes[file] = contentHash(file, assets[file]);
  }
  const html = renderIndex(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), hashes);

  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  for (const file of ASSET_FILES) {
    fs.writeFileSync(path.join(target, file), assets[file]);
  }
  fs.writeFileSync(path.join(target, "index.html"), html);
  return { outDir: target, hashes };
}

if (require.main === module) {
  const result = build();
  process.stdout.write("Built " + path.relative(ROOT, result.outDir) + "/\n");
}

module.exports = { build };
