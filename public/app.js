/* AJAM Yardsales — subscribe helpers */
async function getPublicKey() {
  const res = await fetch('/api/vapid-public-key');
  if (!res.ok) throw new Error('VAPID key unavailable');
  const data = await res.json();
  return data.publicKey;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('Service workers not supported');
  return navigator.serviceWorker.register('/sw.js');
}

async function subscribePush() {
  if (!('PushManager' in window)) throw new Error('Push not supported in this browser');
  const reg = await ensureServiceWorker();
  await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission denied');

  const key = await getPublicKey();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }
  const res = await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Subscribe failed');
  }
  return res.json();
}

async function unsubscribePush() {
  const reg = await ensureServiceWorker();
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { removed: false, note: 'No local subscription' };
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  const res = await fetch('/api/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
  const data = await res.json().catch(() => ({}));
  return { removed: true, ...data };
}

function showStatus(el, msg, kind) {
  if (!el) return;
  el.textContent = msg;
  el.className = 'status show ' + (kind || 'info');
}

window.AJAM = { subscribePush, unsubscribePush, showStatus, ensureServiceWorker };
