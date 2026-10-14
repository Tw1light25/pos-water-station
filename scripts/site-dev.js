/**
 * Local preview server for the customer site.
 *
 * Serves `site/` statically and routes `/api/*` to the exact same Netlify
 * function modules that get deployed - so what you test locally is what runs in
 * production. Requires no Netlify CLI.
 *
 *   npm run site:dev     ->  http://127.0.0.1:4000
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

const SITE = path.join(ROOT, 'site');
const PORT = Number(process.env.SITE_PORT || 4000);
const HOST = '127.0.0.1';

const ROUTES = {
  '/api/settings': () => import('../netlify/functions/settings.js'),
  '/api/products': () => import('../netlify/functions/products.js'),
  '/api/orders': () => import('../netlify/functions/orders.js'),
  '/api/track': () => import('../netlify/functions/track.js'),
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? HOST}`);

  if (url.pathname in ROUTES) {
    try {
      const module = await ROUTES[url.pathname]();
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
      const request = new Request(url, { method: req.method, headers: req.headers, body });
      const response = await module.default(request, {});
      const text = await response.text();
      send(res, response.status, Object.fromEntries(response.headers), text);
    } catch (error) {
      console.error('[site-dev]', url.pathname, error);
      send(res, 500, { 'content-type': 'application/json' }, JSON.stringify({ error: error.message }));
    }
    return;
  }

  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  let filePath = path.join(SITE, requested);

  if (!filePath.startsWith(SITE)) {
    send(res, 403, { 'content-type': 'text/plain' }, 'Forbidden');
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    if (fs.existsSync(`${filePath}.html`)) filePath = `${filePath}.html`;
    else {
      send(res, 404, { 'content-type': 'text/html; charset=utf-8' }, '<h1>404 - not found</h1>');
      return;
    }
  }

  send(
    res,
    200,
    {
      'content-type': MIME[path.extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    },
    fs.readFileSync(filePath),
  );
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is in use. Set SITE_PORT in .env to another port.\n`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('--------------------------------------------------------------');
  console.log('  Water Station - customer site (local preview)');
  console.log('--------------------------------------------------------------');
  console.log(`  Landing   http://${HOST}:${PORT}/`);
  console.log(`  Order     http://${HOST}:${PORT}/order`);
  console.log(`  Track     http://${HOST}:${PORT}/track`);
  console.log(`  API       ${Object.keys(ROUTES).join(', ')}`);
  console.log('--------------------------------------------------------------');
  console.log('');
});
