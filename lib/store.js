const fs = require('fs');
const path = require('path');

let jsonPath = null;
let jsonCache = { subscriptions: [] };

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadJson() {
  if (fs.existsSync(jsonPath)) {
    try {
      jsonCache = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (!Array.isArray(jsonCache.subscriptions)) jsonCache.subscriptions = [];
    } catch {
      jsonCache = { subscriptions: [] };
    }
  }
}

function saveJson() {
  ensureDir(jsonPath);
  fs.writeFileSync(jsonPath, JSON.stringify(jsonCache, null, 2));
}

function init(databasePath) {
  const dbPath = databasePath || './data/subscriptions.json';
  jsonPath = dbPath.replace(/\.db$/i, '.json');
  if (!jsonPath.endsWith('.json')) jsonPath = dbPath.endsWith('.json') ? dbPath : dbPath + '.json';
  ensureDir(jsonPath);
  loadJson();
  console.log('[store] using JSON at', jsonPath);
  return 'json';
}

function add(sub) {
  if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    throw new Error('Invalid subscription');
  }
  const idx = jsonCache.subscriptions.findIndex((s) => s.endpoint === sub.endpoint);
  const row = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    created_at: new Date().toISOString(),
  };
  if (idx >= 0) jsonCache.subscriptions[idx] = row;
  else jsonCache.subscriptions.push(row);
  saveJson();
}

function remove(endpoint) {
  if (!endpoint) return false;
  const before = jsonCache.subscriptions.length;
  jsonCache.subscriptions = jsonCache.subscriptions.filter((s) => s.endpoint !== endpoint);
  if (jsonCache.subscriptions.length !== before) {
    saveJson();
    return true;
  }
  return false;
}

function list() {
  return jsonCache.subscriptions.map((s) => ({
    endpoint: s.endpoint,
    keys: { p256dh: s.keys.p256dh, auth: s.keys.auth },
  }));
}

function count() {
  return jsonCache.subscriptions.length;
}

function getMode() {
  return 'json';
}

module.exports = { init, add, remove, list, count, getMode };
