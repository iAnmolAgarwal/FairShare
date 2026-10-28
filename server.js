"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT) || 5000;
const ROOT = process.env.FAIRSHARE_ROOT || __dirname;

const SERVER_JS = fs.readFileSync(__filename);

const ALLOWED_METHODS = new Set(["GET", "HEAD"]);

const ROUTES = [
  {
    path: "/",
    file: "index.html",
    type: "text/html; charset=utf-8",
    html: true,
  },
  {
    path: "/index.html",
    file: "index.html",
    type: "text/html; charset=utf-8",
    html: true,
  },
  {
    path: "/core.js",
    file: "core.js",
    type: "text/javascript; charset=utf-8",
    html: false,
  },
  {
    path: "/app.js",
    file: "app.js",
    type: "text/javascript; charset=utf-8",
    html: false,
  },
  {
    path: "/styles.css",
    file: "styles.css",
    type: "text/css; charset=utf-8",
    html: false,
  },
];

const ROUTE_MAP = new Map();
for (const route of ROUTES) {
  ROUTE_MAP.set(route.path, route);
}

const FILE_CACHE = new Map();
/** Sentinel value for files that failed to load. */
const FAILED_FILE = { failed: true };

function loadFile(fileName) {
  const filePath = path.join(ROOT, fileName);
  let data, stat;
  try {
    data = fs.readFileSync(filePath);
    stat = fs.statSync(filePath);
  } catch {
    FILE_CACHE.set(fileName, FAILED_FILE);
    return null;
  }
  const hash = crypto
    .createHash("sha256")
    .update(SERVER_JS)
    .update(fileName)
    .update(data)
    .digest("hex")
    .substring(0, 16);
  FILE_CACHE.set(fileName, { data, mtime: stat.mtimeMs, hash });
  return FILE_CACHE.get(fileName);
}

for (const route of ROUTES) {
  loadFile(route.file);
}

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function send(res, { status, contentType, body, headers }) {
  const merged = Object.assign(
    { "Content-Type": contentType },
    SECURITY_HEADERS,
    headers,
  );
  res.writeHead(status, merged);
  res.end(body);
}

function sendError(res, status, message, extra) {
  send(res, {
    status,
    contentType: "text/plain; charset=utf-8",
    body: message,
    headers: Object.assign({ "Cache-Control": "no-store" }, extra),
  });
}

function matchQuery(reqUrl) {
  try {
    const parts = (reqUrl || "/").split("?");
    return {
      path: decodeURIComponent(parts[0]),
      query: parts.length > 1 ? parts[1] : "",
    };
  } catch {
    return null;
  }
}

function getEntry(fileName) {
  const filePath = path.join(ROOT, fileName);
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    FILE_CACHE.set(fileName, FAILED_FILE);
    return FAILED_FILE;
  }
  const cached = FILE_CACHE.get(fileName);
  if (cached && cached !== FAILED_FILE && cached.mtime === stat.mtimeMs) {
    return cached;
  }
  return loadFile(fileName) || FAILED_FILE;
}

function hasValidVersion(parsed, fileName) {
  if (!parsed || !parsed.query) {
    return false;
  }
  const m = /^v=([0-9a-f]{16})$/.exec(parsed.query);
  return m !== null && m[1] === getEntry(fileName).hash;
}

function cacheControlFor(route, parsed) {
  if (route.html) {
    return "no-cache";
  }
  if (hasValidVersion(parsed, route.file)) {
    return "public, max-age=31536000, immutable";
  }
  return "no-cache";
}

function responseBody(method, data) {
  if (method === "HEAD") {
    return undefined;
  }
  return data;
}

function handleHtmlRoute(res, route) {
  const core = getEntry("core.js");
  const app = getEntry("app.js");
  const css = getEntry("styles.css");
  const index = getEntry("index.html");
  if (
    core === FAILED_FILE ||
    app === FAILED_FILE ||
    css === FAILED_FILE ||
    index === FAILED_FILE
  ) {
    sendError(res, 503, "Service unavailable");
    return;
  }
  const html = index.data
    .toString("utf8")
    .replace(/(core\.js|app\.js|styles\.css)\?v=[\w.]*/g, (match, file) => {
      return file + "?v=" + getEntry(file).hash;
    });
  send(res, {
    status: 200,
    contentType: route.type,
    body: html,
    headers: {
      "Cache-Control": "no-cache",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'",
    },
  });
}

const server = http.createServer((req, res) => {
  const method = req.method || "GET";

  if (!ALLOWED_METHODS.has(method)) {
    sendError(res, 405, "Method Not Allowed", { Allow: "GET, HEAD" });
    return;
  }

  const parsed = matchQuery(req.url);
  if (!parsed) {
    sendError(res, 400, "Bad request");
    return;
  }
  if (parsed.path.indexOf("\0") !== -1) {
    sendError(res, 400, "Bad request");
    return;
  }

  const route = ROUTE_MAP.get(parsed.path);
  if (!route) {
    sendError(res, 404, "Not found");
    return;
  }

  const filePath = path.join(ROOT, route.file);
  if (path.dirname(filePath) !== ROOT) {
    sendError(res, 404, "Not found");
    return;
  }

  if (route.html) {
    handleHtmlRoute(res, route);
    return;
  }

  const entry = getEntry(route.file);
  if (entry === FAILED_FILE) {
    sendError(res, 503, "Service unavailable");
    return;
  }
  send(res, {
    status: 200,
    contentType: route.type,
    body: responseBody(method, entry.data),
    headers: { "Cache-Control": cacheControlFor(route, parsed) },
  });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    process.stdout.write(
      "FairShare frontend available at http://" + HOST + ":" + PORT + "\n",
    );
  });
}

module.exports = server;
