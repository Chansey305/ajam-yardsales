# AJAM Yardsales

Plain web-push PWA for Floresville yard-sale customers. Short alerts like “Alex is having a yard sale today” (+ time/place when provided).

**Branding:** always **AJAM Yardsales** (never “Yard Sale Notify”).

## Stack

- Node + Express
- `web-push` + VAPID
- Subscriptions: `better-sqlite3` when it builds; otherwise a JSON file store (see server log)

## Setup

```bash
cd /workspace/ajam-yardsales
cp .env.example .env
npm install
npm run generate-vapid
```

Copy the printed `VAPID_*` lines into `.env`. Set a strong `ADMIN_SECRET`.

Or generate keys with:

```bash
npx web-push generate-vapid-keys
```

## Run locally

```bash
npm start
```

Open http://localhost:3000 — health check: http://localhost:3000/api/health

## Subscribe on a phone

1. Serve over **HTTPS** (required for push on real devices; `localhost` is allowed for desktop testing).
2. Open the site, tap **Subscribe to alerts**, allow notifications.
3. Optionally **Add to Home Screen** for the AJAM Yardsales PWA.

Without HTTPS on a LAN IP, browsers block Push / Notification permission.

## Admin notify

1. Open `/admin`.
2. Enter `ADMIN_SECRET` from `.env`.
3. **Notify now** — sends to all subscribers (`name` / `time` / `place`, or custom `body`).
4. **Test send** — fixed sample: Alex · 9am–2pm · Floresville.

API equivalents:

```bash
curl -X POST http://localhost:3000/api/notify \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_SECRET" \
  -d '{"name":"Alex","time":"9am","place":"Floresville"}'

curl -X POST http://localhost:3000/api/test \
  -H "x-admin-secret: YOUR_SECRET"
```

## Calendar hook (stub)

`POST /api/calendar-hook` accepts simple JSON for a future Google Calendar auto-notify. **Not integrated with Google.**

```bash
curl -X POST http://localhost:3000/api/calendar-hook \
  -H "Content-Type: application/json" \
  -d '{"name":"Alex","time":"Sat 8am","place":"Floresville","send":true,"adminSecret":"YOUR_SECRET"}'
```

Without a valid secret, the payload is accepted (`202`) but no push is sent. With secret + `send: true`, it notifies like `/api/notify`.

## Routes

| Method | Path | Notes |
|--------|------|--------|
| GET | `/` | Subscribe page |
| GET | `/unsubscribe` | Unsubscribe |
| GET | `/admin` | Tiny admin UI |
| GET | `/api/health` | Health / store mode |
| GET | `/api/vapid-public-key` | Public VAPID key for clients |
| POST | `/api/subscribe` | Save push subscription |
| POST | `/api/unsubscribe` | Remove by endpoint |
| POST | `/api/notify` | Admin secret required |
| POST | `/api/test` | Admin secret required |
| POST | `/api/calendar-hook` | Stub; optional notify with secret |

## Env

See `.env.example`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `ADMIN_SECRET`, `PORT`, `DATABASE_PATH`.

## Out of scope

SMS, marketplace, Facebook, payments, chat, CRM, Google Calendar integration.
