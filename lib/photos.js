const fs = require('fs');
const path = require('path');

let filePath = null;
let cache = { urls: [], updatedAt: null };

const MAX_PHOTOS = 12;

function ensureDir(p) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load() {
  if (!filePath || !fs.existsSync(filePath)) {
    cache = { urls: [], updatedAt: null };
    return;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const urls = Array.isArray(parsed.urls) ? parsed.urls.filter((u) => typeof u === 'string') : [];
    cache = { urls, updatedAt: parsed.updatedAt || null };
  } catch {
    cache = { urls: [], updatedAt: null };
  }
}

function save() {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(cache, null, 2));
}

function init(databasePath) {
  const dbPath = databasePath || './data/subscriptions.json';
  const dir = path.dirname(dbPath.replace(/\.db$/i, '.json'));
  filePath = path.join(dir, 'photos.json');
  ensureDir(filePath);
  load();
  console.log('[photos] using', filePath);
  return filePath;
}

function list() {
  return { urls: cache.urls.slice(), updatedAt: cache.updatedAt };
}

function isHttpUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function setUrls(urls) {
  if (!Array.isArray(urls)) throw new Error('urls must be an array');
  const cleaned = [];
  for (const raw of urls) {
    if (typeof raw !== 'string') continue;
    const s = raw.trim();
    if (!s) continue;
    if (!isHttpUrl(s)) throw new Error('Only http(s) image links allowed: ' + s.slice(0, 80));
    cleaned.push(s);
    if (cleaned.length >= MAX_PHOTOS) break;
  }
  cache = { urls: cleaned, updatedAt: new Date().toISOString() };
  save();
  return list();
}

module.exports = { init, list, setUrls, MAX_PHOTOS };
