import express from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { validatePacket } from '../../shared/protocol';

dotenv.config({ quiet: true });
const PORT = Number(process.env.PORT || 3000);
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) throw new Error('PORT must be an integer between 0 and 65535');
const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:4173,http://127.0.0.1:5174').split(',');
if (origins.includes('*')) throw new Error('ALLOWED_ORIGINS must list explicit origins');
const databasePath = process.env.DATABASE_PATH || resolve('data/hillalert.sqlite');
if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
database.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, packet TEXT NOT NULL, received_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS receipts_age ON receipts(received_at); PRAGMA user_version=1;');
const cleanup = () => database.prepare('DELETE FROM receipts WHERE received_at < ?').run(new Date(Date.now() - 7 * 86400000).toISOString());
cleanup();
const maintenance = setInterval(cleanup, 3600000); maintenance.unref();
const app = express();
app.disable('x-powered-by');
const httpServer = createServer(app);
const allowed = (origin: string | undefined) => !origin || origins.includes(origin);
const io = new Server(httpServer, { cors: { origin: origins }, maxHttpBufferSize: 8192, allowRequest: (req, done) => done(null, allowed(req.headers.origin)), transports: ['polling', 'websocket'] });
const log = (level: string, event: string, extra = {}) => console.log(JSON.stringify({ level, event, time: new Date().toISOString(), ...extra }));
app.use((req, res, next) => {
  const requestId = randomUUID(); res.locals.requestId = requestId;
  res.setHeader('X-Request-ID', requestId); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'no-store');
  if (!allowed(req.headers.origin)) { res.status(403).json({ error: { code: 'ORIGIN_DENIED', message: 'Origin is not allowed', requestId } }); return; }
  next();
});
app.use(cors({ origin: origins }));
const requests = new Map<string, { time: number; count: number }>();
app.use((req, res, next) => {
  const now = Date.now();
  for (const [key, value] of requests) if (now - value.time > 60000) requests.delete(key);
  const key = req.socket.remoteAddress || 'unknown';
  if (!requests.has(key) && requests.size >= 10000) { res.status(503).json({ error: { code: 'BUSY', message: 'Try again later' } }); return; }
  const record = requests.get(key) || { time: now, count: 0 }; record.count++; requests.set(key, record);
  if (record.count > 120) { res.setHeader('Retry-After', '60'); res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests', requestId: res.locals.requestId } }); return; }
  next();
});
app.use(express.json({ limit: '8kb' }));
app.get('/api/health', (_req, res) => { database.prepare('SELECT 1').get(); res.json({ status: 'ok', service: 'HillAlert', protocol: 1, dispatchIntegrated: false }); });
const publicAlerts = () => (database.prepare('SELECT packet FROM receipts ORDER BY received_at DESC LIMIT 500').all() as { packet: string }[]).map(row => JSON.parse(row.packet)).filter(packet => packet.type === 'HAZARD_REPORT');
app.get('/api/alerts', (_req, res) => res.json(publicAlerts()));
app.get('/api/alerts/:id', (req, res) => { const packet = publicAlerts().find(value => value.id === req.params.id); if (!packet) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Alert not found' } }); return; } res.json(packet); });
for (const [route, type] of [['/api/sos', 'SOS'], ['/api/reports', 'HAZARD_REPORT']]) {
  app.post(route!, (req, res, next) => {
    try {
      const packet = validatePacket(req.body);
      if (packet.type !== type || packet.source !== 'COMMUNITY REPORT') { res.status(400).json({ error: { code: 'INVALID_PACKET', message: 'Only community submissions are accepted', requestId: res.locals.requestId } }); return; }
      if (packet.type === 'HAZARD_REPORT' && packet.location) packet.location = { latitude: Math.round(packet.location.latitude * 100) / 100, longitude: Math.round(packet.location.longitude * 100) / 100 };
      const existing = database.prepare('SELECT packet, received_at FROM receipts WHERE id = ?').get(packet.id) as { packet: string; received_at: string } | undefined;
      if (existing) {
        if (existing.packet !== JSON.stringify(packet)) { res.status(409).json({ error: { code: 'ID_CONFLICT', message: 'Message ID already belongs to a different payload' } }); return; }
        res.json({ id: packet.id, acknowledged: true, receivedAt: existing.received_at, duplicate: true, dispatchNotified: false }); return;
      }
      const receivedAt = new Date().toISOString();
      database.prepare('INSERT INTO receipts (id, packet, received_at) VALUES (?, ?, ?)').run(packet.id, JSON.stringify(packet), receivedAt);
      log('INFO', 'submission_stored', { requestId: res.locals.requestId, type });
      res.status(201).json({ id: packet.id, acknowledged: true, receivedAt, dispatchNotified: false });
    } catch (error) { if (error instanceof SyntaxError || (error instanceof Error && /packet|payload|TTL|ACK|location|times|version|identity/i.test(error.message))) { res.status(400).json({ error: { code: 'INVALID_PACKET', message: 'Invalid, oversized, or expired packet', requestId: res.locals.requestId } }); } else next(error); }
  });
}
// Configure verified resources and contact data through deployment-owned JSON files.
import { readFileSync } from 'node:fs';
function configuredArray(path: string | undefined): unknown[] { if (!path) return []; const value = JSON.parse(readFileSync(path, 'utf8')); if (!Array.isArray(value)) throw new Error('Configured data must be an array'); return value; }
const resources = configuredArray(process.env.RESOURCES_FILE);
const contacts = configuredArray(process.env.CONTACTS_FILE);
app.get('/api/resources', (_req, res) => res.json(resources));
app.get('/api/emergency-contacts', (_req, res) => res.json(contacts));
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found', requestId: res.locals.requestId } }));
app.use((error: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = error.status === 413 ? 413 : error instanceof SyntaxError ? 400 : 500;
  log('ERROR', 'request_failed', { requestId: res.locals.requestId, status });
  res.status(status).json({ error: { code: status === 413 ? 'TOO_LARGE' : 'REQUEST_FAILED', message: status === 500 ? 'Server could not store the request. Retry later.' : 'Invalid request body', requestId: res.locals.requestId } });
});
io.on('connection', socket => {
  if (io.engine.clientsCount > 100) { socket.disconnect(true); return; }
  let lastPing = 0;
  socket.on('connection:ping', acknowledge => { if (Date.now() - lastPing < 1000) return; lastPing = Date.now(); if (typeof acknowledge === 'function') acknowledge({ status: 'ok' }); });
});
httpServer.listen(PORT, () => { const address = httpServer.address(); console.log(`Backend server running on port ${typeof address === 'object' && address ? address.port : PORT}`); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { clearInterval(maintenance); io.close(); httpServer.close(() => { database.close(); process.exit(0); }); setTimeout(() => process.exit(0), 3000).unref(); });
