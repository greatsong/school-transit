import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import handler from '../api/arrivals.js';
import nearby from '../api/nearby.js';
import config from '../api/config.js';
import subway from '../api/subway.js';
const root = resolve('dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/subway') return subway(req,res);
  if (url.pathname === '/api/config') return config(req,res);
  if (url.pathname === '/api/nearby') return nearby(req,res);
  if (url.pathname === '/api/arrivals') return handler(req, res);
  try {
    const file = resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
    if (!file.startsWith(root + '/')) throw new Error();
    const body = await readFile(file);
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy','geolocation=(), camera=(), microphone=()');
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch { res.statusCode = 404; res.end('Not found'); }
}).listen(Number(process.env.PORT || 4318), '127.0.0.1', () => console.log('Local app: http://127.0.0.1:' + (process.env.PORT || 4318)));
