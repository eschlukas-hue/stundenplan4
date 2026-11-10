// One-origin Render app: serves the React UI and its read-only WebUntis API.
// The browser calls /api/webuntis/week on this same host, so no cross-origin
// connect-src permission is needed. No WebUntis login credentials are used.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 10000);
const SCHOOL = process.env.WEBUNTIS_SCHOOL || 'hh5842';
const ELEMENT_TYPE = process.env.WEBUNTIS_ELEMENT_TYPE || '1';
const ELEMENT_ID = process.env.WEBUNTIS_ELEMENT_ID || '1669';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const CACHE_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60 * 1000;
const cache = new Map();
const buckets = new Map();
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8',
};

function json(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(value));
}

function monday(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || '')) return null;
  const d = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dateString) return null;
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function allowRequest(req) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now - b.started >= RATE_WINDOW_MS) b = { started: now, count: 0 };
  b.count++;
  buckets.set(ip, b);
  if (buckets.size > 1000) {
    for (const [key, value] of buckets) if (now - value.started > RATE_WINDOW_MS) buckets.delete(key);
  }
  return b.count <= RATE_LIMIT;
}

async function webuntis(req, res, url) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  if (!allowRequest(req)) return json(res, 429, { error: 'Zu viele Anfragen. Bitte kurz warten.' });

  const school = url.searchParams.get('school') || SCHOOL;
  const elementType = url.searchParams.get('elementType') || ELEMENT_TYPE;
  const elementId = url.searchParams.get('elementId') || ELEMENT_ID;
  const date = monday(url.searchParams.get('date'));
  if (school !== SCHOOL || elementType !== ELEMENT_TYPE || elementId !== ELEMENT_ID) {
    return json(res, 400, { error: 'Nur der konfigurierte WebUntis-Stundenplan ist freigegeben.' });
  }
  if (!date) return json(res, 400, { error: 'Ungültiges Datum. Erwartet wird YYYY-MM-DD.' });

  const key = `${school}:${elementType}:${elementId}:${date}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return json(res, 200, hit.data);

  const upstreamUrl = new URL(`https://${school}.webuntis.com/WebUntis/api/public/timetable/weekly/data`);
  upstreamUrl.search = new URLSearchParams({ elementType, elementId, date, formatId: '1' }).toString();
  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: 'application/json, text/plain, */*' },
      signal: AbortSignal.timeout(12000),
    });
    const body = await upstream.text();
    if (!upstream.ok) return json(res, 502, { error: `WebUntis antwortete mit HTTP ${upstream.status}.` });
    let data;
    try { data = JSON.parse(body); }
    catch { return json(res, 502, { error: 'WebUntis lieferte keine lesbare JSON-Antwort.' }); }
    if (data?.error || !data?.data?.result?.data?.elementPeriods) {
      return json(res, 502, { error: 'WebUntis lieferte keine Stundenplandaten für diese Woche.' });
    }
    cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
    return json(res, 200, data);
  } catch (error) {
    const message = error?.name === 'TimeoutError' ? 'Zeitüberschreitung beim Abruf von WebUntis.' : 'WebUntis ist momentan nicht erreichbar.';
    return json(res, 502, { error: message });
  }
}

function staticFile(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { return json(res, 400, { error: 'Ungültiger Pfad' }); }
  const candidate = path.resolve(DIST, `.${pathname}`);
  if (candidate !== DIST && !candidate.startsWith(DIST + path.sep)) return json(res, 403, { error: 'Forbidden' });
  const file = fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) return json(res, 503, { error: 'Frontend noch nicht gebaut. Render Build Command muss npm run build ausführen.' });
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/health') return json(res, 200, { ok: true, service: 'stundenplan-live' });
  if (url.pathname === '/api/webuntis/week') return webuntis(req, res, url);
  if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Not found' });
  return staticFile(req, res, url);
});

server.listen(PORT, '0.0.0.0', () => console.log(`Stundenplan live app listening on ${PORT}`));
