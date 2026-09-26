# Backend Status

Legend: ✅ done · 🟡 partial · ⬜ not started

_Last updated: 2026-09-24_

## Migration from Next.js
Every route of the old `src/app/api` and every service/repository of `src/server` now lives here, with the
same logic, on MongoDB. The Next app no longer contains backend code: pages call this API.

| Area | API | Tests |
|---|---|---|
| Sign-up with WhatsApp code (+ invite code), login (+ email code), logout, login lock | ✅ `/user/auth/*` | ✅ |
| Account: me (user + plan + FX rate), preferences, location (GPS / manual) | ✅ `/user/account/*` | ✅ (me, preferences) |
| Trading session: dashboard, start, trade, payout change, finish, locks, milestones, guards | ✅ `/user/session*` | ✅ |
| Risk settings: protected (time lock), flexible (reset to recommended) | ✅ `/user/settings*` | ✅ |
| History, weekly analytics, insights | ✅ `/user/history*`, `/user/analytics/*` | ✅ (history, weekly) |
| Plans page data, Razorpay create-order + verify, webhook (idempotent) | ✅ | ✅ (verify, webhook) |
| Referrals page, community board | ✅ | ⬜ |
| Admin: login, overview, users (search/filter, detail, assign/adjust/revoke plan, disable, unlock, community access, country, delete) | ✅ | ✅ (most) |
| Admin: plans + features, recommended/lock/community settings, referrals, payments, messaging, WhatsApp sessions, audit | ✅ | ✅ (plans, recommended) |
| Public: health, invite | ✅ | ✅ |
| Postgres -> MongoDB migration script | ✅ written | ⬜ not run (needs the old DB password) |

## Verification log
- 2026-09-24: `npm run lint` clean. `npm test` — 150/150 (123 unit incl. the old core tests, 27 integration on an in-memory replica set).
- 2026-09-24: Against MongoDB Atlas, through the Next app on :3000 (`next build` + `next start`): user login via the rewrite sets `rc_session`; all 9 user pages and 9 admin pages return 200; unauthenticated pages redirect to login; trading day start ₹200 -> loss -> recovery ₹275 -> win -> finish; history detail page; preferences; flexible settings; admin search; admin delete (soft) -> user page 404; logout -> redirect. No errors in either log.
- 2026-09-25: Full live run on the dev servers (website :3000 -> API :5500 -> Atlas), 142/142 checks: 14 public pages, auth redirects, sign-up with WhatsApp code (wrong + right code), all 10 user pages, account/location/preferences, flexible settings + reset, trading day (₹200 -> loss -> ₹275 recovery, protection block, payout change, win at 90% -> +₹47.5, finish, history + detail, weekly, insights), plans/payments (disabled -> 503), referrals, community gate, admin login/pages (10), user search/detail, assign/adjust/revoke plan, disable (user signed out) / enable, unlock, community access, country, audit trail, plans/features/recommended/lock/community/referral settings saved unchanged, payment + messaging settings hide secrets, WhatsApp number connected, logout, soft delete. Lint clean; backend tests 150/150; frontend tests 109/109; next build OK.
- 2026-09-25: WhatsApp connect fixed (standard Baileys browser id, creds saved before reconnect, one socket per number). A registration OTP was sent from the connected number.
- Not checked in a browser by hand: WhatsApp QR connect, real Razorpay checkout, real email sending (need real accounts/keys).

## Next
- ⬜ Run `migrate:from-postgres` against the old database (needs its password and the old `APP_ENCRYPTION_KEY`/session secrets).
- ⬜ Tests for referrals rewards on first payment, community board, WhatsApp admin actions.
- ⬜ Purge job for old raw trades (`jobs/`).
- ⬜ Change the Razorpay webhook URL to `/api/v1/webhook/razorpay` when payments go live.

## Blog (2026-09-26)
- ✅ Model `blogs` (soft delete, unique slug, previous_slugs), sanitize-html, reading time, audit log for create/update/publish/delete.
- ✅ Public API: GET /public/blogs, /featured, /categories, /sitemap, /:slug (+ related, or { redirectTo }), POST /:slug/view.
- ✅ Admin API (super admin): GET/POST /admin/blogs, GET/PUT/DELETE /admin/blogs/:id, PATCH /:id/status, POST /upload-image (Cloudinary).
- ✅ Website revalidation after changes (REVALIDATE_SECRET); failures are only logged.
- ✅ `npm run seed:blogs`: 6 published posts (1000+ words each, 1 Hindi), idempotent.
- Verified: backend 157/157 tests (7 blog tests); live run website -> API -> Atlas 33/33 (publish goes live instantly, old slug 308, unpublish 404, draft preview, upload validation).
- ⬜ Cloudinary keys not set yet, so uploads answer 503 (UPLOAD_UNAVAILABLE).
