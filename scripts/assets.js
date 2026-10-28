"use strict";

// Shared by server.js (dev server) and scripts/build.js (static build) so both
// version asset URLs and apply the Content Security Policy the same way.

const crypto = require("crypto");

const ASSET_FILES = ["core.js", "app.js", "styles.css"];

const ASSET_REF_PATTERN = /(core\.js|app\.js|styles\.css)\?v=[\w.]*/g;

const CONTENT_SECURITY_POLICY =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'";

// Browsers ignore these directives when the policy is delivered in a <meta> tag.
const HEADER_ONLY_DIRECTIVES = new Set(["frame-ancestors", "report-uri", "report-to", "sandbox"]);

/**
 * First 16 hex chars of sha256(salt + fileName + data).
 * server.js salts with its own source so header changes also bust caches.
 */
function contentHash(fileName, data, salt) {
  const hash = crypto.createHash("sha256");
  if (salt !== undefined) {
    hash.update(salt);
  }
  return hash.update(fileName).update(data).digest("hex").substring(0, 16);
}

/** Replaces every `<asset>?v=...` reference with `<asset>?v=<hashOf(asset)>`. */
function stampAssetUrls(html, hashOf) {
  return html.replace(ASSET_REF_PATTERN, (match, file) => file + "?v=" + hashOf(file));
}

/** A CSP header value (the app's by default) minus directives ignored in a <meta> tag. */
function metaContentSecurityPolicy(policy) {
  return (policy || CONTENT_SECURITY_POLICY)
    .split(";")
    .map((directive) => directive.trim())
    .filter((directive) => directive && !HEADER_ONLY_DIRECTIVES.has(directive.split(/\s+/)[0]))
    .join("; ");
}

module.exports = {
  ASSET_FILES,
  CONTENT_SECURITY_POLICY,
  contentHash,
  stampAssetUrls,
  metaContentSecurityPolicy,
};
