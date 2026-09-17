require('dotenv').config();
const path = require('path');
const express = require('express');
const webpush = require('web-push');
const store = require('./lib/store');
const notified = require('./lib/notified-events');
const photos = require('./lib/photos');
const { sendToAll, buildPayload } = require('./lib/notify');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
const DATABASE_PATH = process.env.DATABASE_PATH || './data/subscriptions.db';

store.init(DATABASE_PATH);
notified.init(DATABASE_PATH);
photos.init(DATABASE_PATH);

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


app.get('/api/photos', (_req, res) => {
  res.json(photos.list());
});

app.put('/api/photos', requireAdmin, (req, res) => {
  try {
    const urls = (req.body && req.body.urls) || [];
    const result = photos.setUrls(urls);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Bad photos payload' });
  }
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
 * Calendar auto-notify entrypoint.
 * Jarvis (or a morning watcher) POSTs sale-day events here.
 * Dedupes by eventId so the same calendar event only notifies once.
 *
 * Example:
 * {
 *   "adminSecret": "...",
 *   "eventId": "google-event-id",
 *   "name": "Alex",
 *   "time": "9am–2pm",
 *   "place": "Floresville",
 *   "send": true
 * }
 */
app.post('/api/calendar-hook', async (req, res) => {
  const body = req.body || {};
  const secret = req.headers['x-admin-secret'] || body.adminSecret;
  const authorized = ADMIN_SECRET && secret === ADMIN_SECRET;
  const eventId = body.eventId ? String(body.eventId) : null;

  const received = {
    name: body.name || null,
    time: body.time || null,
    place: body.place || null,
    eventId,
    start: body.start || null,
    send: Boolean(body.send),
  };

  if (!authorized) {
    return res.status(202).json({
      notified: false,
      received,
      note: 'Provide ADMIN_SECRET (header x-admin-secret or body.adminSecret) and send:true to notify',
    });
  }

  if (!body.send) {
    return res.json({ notified: false, received, note: 'authorized but send was not true' });
  }

  if (eventId && notified.has(eventId)) {
    return res.json({
      notified: false,
      reason: 'already',
      eventId,
      received,
    });
  }

  try {
    const result = await sendToAll(body);
    if (eventId) {
      // Record after an attempt so retries do not spam; include send counts.
      notified.mark(eventId, {
        sent: result.sent,
        failed: result.failed,
        total: result.total,
      });
    }
    res.json({ notified: true, eventId, ...result, preview: buildPayload(body) });
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
