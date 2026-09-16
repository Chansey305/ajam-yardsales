const fs = require('fs');
const path = require('path');

let filePath = null;
let cache = { events: {} };

function ensureDir(p) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load() {
  if (!filePath || !fs.existsSync(filePath)) {
    cache = { events: {} };
    return;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    cache = { events: parsed && typeof parsed.events === 'object' ? parsed.events : {} };
  } catch {
    cache = { events: {} };
  }
}

function save() {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(cache, null, 2));
}

function init(databasePath) {
  const dbPath = databasePath || './data/subscriptions.json';
  const dir = path.dirname(dbPath.replace(/\.db$/i, '.json'));
  filePath = path.join(dir, 'notified-events.json');
  ensureDir(filePath);
  load();
  console.log('[notified-events] using', filePath);
  return filePath;
}

function has(eventId) {
  if (!eventId) return false;
  return Boolean(cache.events[String(eventId)]);
}

function mark(eventId, meta) {
  if (!eventId) return;
  cache.events[String(eventId)] = {
    at: new Date().toISOString(),
    ...(meta && typeof meta === 'object' ? meta : {}),
  };
  save();
}

module.exports = { init, has, mark };
