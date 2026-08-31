/**
 * Serves the storefront on :8080 and proxies /api/* to the Fastify API (:3001).
 * Matches production routing so Playwright hits the same URLs as the live site.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8080);
const API_ORIGIN = process.env.API_ORIGIN || 'http://127.0.0.1:3001';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function safePath(urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0]);
  const rel = decoded.replace(/\0/g, '');
  const joined = path.normalize(path.join(ROOT, rel));
  if (!joined.startsWith(ROOT)) return null;
  return joined;
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

function serveStatic(req, res) {
  let filePath = safePath(req.url);
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      const index = path.join(filePath, 'index.html');
      return fs.stat(index, (e2, st2) => {
        if (!e2 && st2.isFile()) return sendFile(res, index);
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
      });
    }
    if (!err && stat.isFile()) return sendFile(res, filePath);
    const withHtml = filePath + '.html';
    fs.stat(withHtml, (e3, st3) => {
      if (!e3 && st3.isFile()) return sendFile(res, withHtml);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    });
  });
}

function proxyToApi(req, res) {
  const target = new URL(req.url, API_ORIGIN);
  const headers = { ...req.headers, host: target.host };
  const proxyReq = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    }
    res.end(JSON.stringify({ error: 'api_unreachable', message: 'API server is not running.' }));
  });
  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  if (urlPath === '/api' || urlPath.startsWith('/api/')) {
    proxyToApi(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[e2e-static] http://127.0.0.1:${PORT} (api → ${API_ORIGIN})`);
});
