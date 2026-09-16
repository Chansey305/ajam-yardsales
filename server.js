require('dotenv').config();
const path = require('path');
const express = require('express');
const webpush = require('web-push');
const store = require('./lib/store');
const { sendToAll, buildPayload } = require('./lib/notify');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
const DATABASE_PATH = process.env.DATABASE_PATH || './data/subscriptions.db';

store.init(DATABASE_PATH);

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
} else {
  console.warn('[warn] VAPID keys missing — push sends will fail. Run: npm run generate-vapid');
}

const app = express();
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function requireAdmin(req, res, next) {
  const secret =
    req.headers['x-admin-secret'] ||
    (req.body && req.body.adminSecret) ||
    req.query.secret;
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    name: 'AJAM Yardsales',
    store: store.getMode(),
    subscribers: store.count(),
    vapidConfigured: Boolean(VAPID_PUBLIC && VAPID_PRIVATE),
  });
});

app.get('/api/vapid-public-key', (_req, res) => {
  if (!VAPID_PUBLIC) return res.status(503).json({ error: 'VAPID not configured' });
  res.json({ publicKey: VAPID_PUBLIC });
});

app.post('/api/subscribe', (req, res) => {
  try {
    store.add(req.body);
    res.json({ ok: true, subscribers: store.count() });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Bad subscription' });
  }
});

app.post('/api/unsubscribe', (req, res) => {
  const endpoint = req.body && req.body.endpoint;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  const removed = store.remove(endpoint);
  res.json({ ok: true, removed });
});

app.post('/api/notify', requireAdmin, async (req, res) => {
  try {
    const result = await sendToAll(req.body || {});
    res.json({ ok: true, ...result, preview: buildPayload(req.body || {}) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Notify failed' });
  }
});

app.post('/api/test', requireAdmin, async (req, res) => {
  try {
    const result = await sendToAll({
      name: 'Alex',
      time: '9am–2pm',
      place: 'Floresville',
      body: req.body && req.body.body,
    });
    res.json({ ok: true, ...result, note: 'Test send' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Test failed' });
  }
});

/**
 * Stub calendar hook for a future Google Calendar auto-notify.
 * Accepts simple JSON; when admin secret is present, can send a notify.
 * Not integrated with Google — wire your calendar watcher later.
 *
 * Example body:
 * {
 *   "adminSecret": "...",
 *   "name": "Alex",
 *   "time": "Sat 8am",
 *   "place": "123 Main St, Floresville",
 *   "send": true
 * }
 */
app.post('/api/calendar-hook', async (req, res) => {
  const body = req.body || {};
  const secret = req.headers['x-admin-secret'] || body.adminSecret;
  const authorized = ADMIN_SECRET && secret === ADMIN_SECRET;

  const accepted = {
    stub: true,
    message: 'Calendar hook stub — accepted payload, no Google integration',
    received: {
      name: body.name || null,
      time: body.time || null,
      place: body.place || null,
      eventId: body.eventId || null,
      start: body.start || null,
      send: Boolean(body.send),
    },
  };

  if (!authorized) {
    return res.status(202).json({
      ...accepted,
      notified: false,
      note: 'Provide ADMIN_SECRET (header x-admin-secret or body.adminSecret) and send:true to notify',
    });
  }

  if (!body.send) {
    return res.json({ ...accepted, notified: false, note: 'authorized but send was not true' });
  }

  try {
    const result = await sendToAll(body);
    res.json({ ...accepted, notified: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Hook notify failed' });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/unsubscribe', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'unsubscribe.html'));
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`AJAM Yardsales listening on http://localhost:${PORT}`);
  console.log(`Store mode: ${store.getMode()} | subscribers: ${store.count()}`);
});
