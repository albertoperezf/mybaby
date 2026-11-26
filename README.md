# MyBaby

A private, offline-first PWA for newborn care: feeding and diaper log, reminders, and growth tracking with WHO percentile curves. Built with Next.js (App Router) and deployed on Vercel.

**All data stays on the device** (IndexedDB via Dexie). No accounts, no database, no ads, no analytics. The production CSP (`connect-src 'self'`) stops the app from contacting any other origin.

## Features (MVP)

- **Feeding log**: one-tap presets (2/3/4 oz or 60/90/120 ml, plus your last amount), floating quick-action button for a 2-tap flow from any screen, back-dated times, notes, milk type, edit and undo. Log for several babies at once (twins).
- **Diapers**: wet / dirty / both / dry.
- **Stats**: last fed X ago, daily totals, average interval, 7-day chart.
- **Reminders**: "next feeding in X hours" with quiet hours, custom reminders (vitamin, medicine, appointment, other; once/daily/weekly), snooze and dismiss, in-app alarms with notifications, `.ics` calendar export.
- **Growth**: weight, length and head circumference per visit, charted against WHO Child Growth Standards (0-5 years) with percentiles; corrected age for preterm babies.
- **Backup**: JSON export/import (merge or replace), CSV export/import for feedings, diapers and growth, weekly backup nudge, `navigator.storage.persist()`.
- **PWA**: installable, offline shell, iOS icons and splash screens, home-screen shortcuts.
- **UI**: mobile-first with bottom nav and thumb-zone button, desktop sidebar dashboard, Light / Dark / Night (red-shifted) themes, English and Spanish, oz/ml and lb-in/kg-cm.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000  (service worker is disabled in dev)
```

| Script | Purpose |
| --- | --- |
| `npm run build` / `npm start` | Production build and server (needed to test the service worker) |
| `npm test` | Unit and IndexedDB integration tests (Vitest + fake-indexeddb) |
| `npm run e2e` | Playwright tests against a production build: flows, offline, a11y (axe) in 3 themes |
| `npm run typecheck` / `npm run lint` | Type and lint checks |
| `npm run icons` | Regenerate PWA icons and iOS splash screens (`scripts/generate-icons.mjs`) |

Locally, Playwright uses your installed Google Chrome. In CI (`CI=1`) it uses Playwright's Chromium (`npx playwright install --with-deps chromium`).

## Deploy to Vercel

1. Push the repository to GitHub, GitLab or Bitbucket.
2. In Vercel choose **Add New → Project**, import the repo. The framework preset is detected as Next.js; keep the defaults (`npm run build`).
3. No environment variables are needed. (`VERCEL_GIT_COMMIT_SHA` is provided by Vercel and versions the precached pages.)
4. Deploy. Open the production URL on a phone:
   - **Android / Chrome**: use the in-app Install button, or the browser menu.
   - **iPhone / Safari**: Share → Add to Home Screen. This matters: installed PWAs are exempt from Safari's 7-day storage cleanup and are required for notifications.
5. Optional: add a custom domain under Project → Domains. HTTPS is required for the service worker and is automatic on Vercel.

Verify after deploying: open `/manifest.webmanifest`, `/serwist/sw.js`, and run Lighthouse on `/app` (reference build: Performance 97, Accessibility 100, Best Practices 100, SEO 100 on mobile).

## Architecture

```
src/
  app/            routes: / (landing), /privacy, /~offline, /app/* (client app), manifest.ts, sw.ts, serwist/ (SW route)
  components/     app shell, context, UI primitives (Button, Sheet on <dialog>, Toast with undo, ...)
  db/             Dexie schema + versions, types, zod schemas, repo (writes), hooks (live queries), settings
  features/       feeding, reminders, growth, backup, babies, onboarding, nudges
  i18n/           typed en/es messages and provider
  lib/            units, time (tz/DST-safe day buckets), ics, pwa helpers, WHO LMS engine + data
scripts/          icon generator, WHO data builder (python), screenshot helper
tests/            vitest;  e2e/  playwright
```

Key decisions

- **Records are sync-ready from day one**: ULID ids, `updatedAt`, `deletedAt` tombstones and `deviceId` on every row. Import merges by id with last-write-wins, which is the foundation for the planned end-to-end encrypted sync.
- **Canonical units**: ml, grams, millimetres and UTC epoch milliseconds are stored. Display units are converted. Each entry also stores its IANA time zone, and "days" are bucketed in that zone with a configurable day-start hour (2 AM feeds count toward the previous evening).
- **Schema changes** go in new `db.version(n)` blocks in [src/db/schema.ts](src/db/schema.ts) and bump `EXPORT_SCHEMA_VERSION` when the export shape changes.
- **WHO data** is the official LMS tables (weight-, length/height- and head-circumference-for-age, 0-5 years), sampled weekly into `src/lib/who/who-lms.json` (~40 KB, lazy-loaded). Rebuild with `python3 scripts/build-who-data.py <dir of xlsx>`. Source: WHO Child Growth Standards.
- **Service worker**: `@serwist/turbopack` builds `src/app/sw.ts` through a route handler. Pages under `/app` are precached so the app opens offline after the first visit.

## Reminders: what they can and can't do

Browsers cannot wake a fully closed web app without a server. By default reminders fire while the app is open or running in the background (a timer, plus a re-check when the app returns to the foreground), show an OS notification if permitted, and set the app badge. For anything critical, use **Add to calendar (.ics)** so the phone's calendar alerts even when the app is closed, or enable the optional Web Push alerts described below.

Optional Web Push alerts (below) add delivery while the app is closed. A delayed-message queue is used instead of Vercel Cron because Cron on the Hobby plan runs at most once a day.

## Optional: closed-app alerts (Web Push)

Off unless you configure it; without the environment variables below the app works as before and the Reminders page says push isn't set up.

How it works: when a reminder is created or changes, the app asks `/api/push/schedule` to queue one delayed message per upcoming fire time (next 6 days, re-synced whenever the app opens) in [Upstash QStash](https://upstash.com/docs/qstash). At fire time QStash calls `/api/push/send`, which verifies QStash's signature and sends a Web Push (VAPID) to the device. Nothing is stored in a database. The queue holds the push address, a random reminder id and the time; the push payload is just ids, and the service worker builds the visible text from IndexedDB on the device. Cancel/reschedule uses the returned message ids.

Setup:

1. `npm run push:keys` to generate VAPID keys.
2. Create a free Upstash QStash project and copy the token and the two signing keys.
3. In Vercel → Project → Settings → Environment Variables (Production), set the variables from [.env.example](.env.example): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`. `PUSH_BASE_URL` is only needed for a custom origin (Vercel's production domain is picked up automatically). Redeploy.
4. Open the app on the production URL, Reminders → "Alerts when the app is closed" → turn on, then "Send a test notification".

Notes and limits:

- QStash must reach `/api/push/send`, so use the production domain (preview deployments behind Vercel Authentication and `localhost` won't work).
- Only real browser push hosts (FCM, Mozilla, Apple, Windows) are accepted as subscription endpoints, requests are size/time validated, and `/api/push/send` rejects anything not signed by QStash. There is no per-user auth (the app has no accounts), so the scheduling endpoints are protected by validation and a best-effort rate limit; add an Upstash Redis limiter if you expect abuse.
- iOS: requires the app on the Home Screen (16.4+). Android/desktop Chrome, Firefox and Edge work directly.
- Reminders more than 6 days out, or from an app not opened for more than 6 days, won't have queued pushes until the app is opened again.

## Data safety

Browsers can evict IndexedDB. Mitigations built in: persistent-storage request after the first entry, install prompt (with iOS instructions), weekly "back up now" nudge with last-backup date, and one-tap JSON export through the native share sheet on mobile (Save to Files / iCloud). Use Settings → Backup regularly.

## Medical disclaimer

This is a personal log, not a medical device. Percentiles are informational and not a diagnosis; consult a pediatrician.

## Roadmap

- **v1**: sleep and breast/pump timers, medication log with dosage, vaccine checklist, doctor-visit notes, pediatrician PDF report, share-by-file for a second caregiver, encrypted backup file.
- **v2**: end-to-end encrypted sync between devices (QR pairing), milestones and photo journal, more locales, optional Capacitor wrapper for widgets and native notifications.
