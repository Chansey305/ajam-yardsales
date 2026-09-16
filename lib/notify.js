const webpush = require('web-push');
const store = require('./store');

function buildPayload({ name, time, place, body, url }) {
  const who = (name && String(name).trim()) || 'Someone';
  let title = 'AJAM Yardsales';
  let text = `${who} is having a yard sale today`;
  const bits = [];
  if (time && String(time).trim()) bits.push(String(time).trim());
  if (place && String(place).trim()) bits.push(String(place).trim());
  if (bits.length) text += ' — ' + bits.join(' · ');
  if (body && String(body).trim()) text = String(body).trim();
  return {
    title,
    body: text,
    url: (url && String(url).trim()) || '/',
    tag: 'ajam-yardsale',
  };
}

function kindOf(endpoint) {
  if (!endpoint) return 'unknown';
  if (endpoint.includes('web.push.apple.com')) return 'apple';
  if (endpoint.includes('fcm.googleapis.com') || endpoint.includes('android.googleapis.com')) return 'chrome';
  return 'other';
}

async function sendToAll(payloadObj) {
  const payload = JSON.stringify(buildPayload(payloadObj || {}));
  const subs = store.list();
  let sent = 0;
  let failed = 0;
  const gone = [];
  const errors = [];

  for (const sub of subs) {
    const kind = kindOf(sub.endpoint);
    try {
      await webpush.sendNotification(sub, payload);
      sent++;
    } catch (err) {
      failed++;
      const code = err.statusCode;
      const body = err.body
        ? Buffer.isBuffer(err.body)
          ? err.body.toString()
          : String(err.body)
        : '';
      errors.push({
        kind,
        statusCode: code || null,
        message: err.message || 'send failed',
        body: body.slice(0, 300),
      });
      console.error('[notify] fail', kind, code, body || err.message);
      if (code === 404 || code === 410) gone.push(sub.endpoint);
    }
  }

  for (const endpoint of gone) store.remove(endpoint);

  return {
    sent,
    failed,
    removed: gone.length,
    total: subs.length,
    errors,
  };
}

module.exports = { buildPayload, sendToAll };
