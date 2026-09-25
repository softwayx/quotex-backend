# RiskQuo Backend — rules (read first, every session)

Express REST API for RiskQuo. The Next.js app in the parent folder is only the frontend: its pages call
this API (server components via `src/lib/server-api.js`, the browser via the `/api/v1/*` rewrite in
`next.config.mjs`). Read `docs/STATUS.md` (what exists) and `docs/DECISIONS.md` (why) before working.

## Stack (fixed)
Node 20+, Express 4, **JavaScript ESM (no TypeScript)**, MongoDB (Atlas) + Mongoose, Zod, cookie sessions
(JWT holding a server-side session id), bcrypt, pino, Jest + supertest + mongodb-memory-server.

## Folder structure
```
backend/
  CLAUDE.md  docs/{STATUS,DECISIONS,REQUIREMENTS}.md  postman/  scripts/ (seed-admin, migrate-from-postgres)
  src/
    app.js  server.js
    config/       env.js (Zod, missing = crash), database.js (connect, withTransaction), constants.js
    models/       index.js (registry), base.js (defineModel, toRow, lockDoc), plugins/softDelete.js, *.model.js
    seeders/      defaults.js (settings documents + system plans, idempotent, runs on start)
    domain/       audience-independent logic: core/ (pure rules engine), shared/, auth, users, plans,
                  subscriptions, entitlements, features, settings, trading, fx, referrals, payments,
                  messaging (email, WhatsApp), location, audit, rbac
    modules/      by AUDIENCE: admin/, user/, public/, webhook/ — each feature: *.routes, *.controller,
                  *.service, *.schema (schema only when it takes input)
    routes/       index.js + admin/user/public/webhook route files -> /api/v1/{admin,user,public,webhook}
    middlewares/  authenticate (authUser, authAdmin), requirePermission, validate, errorHandler
    jobs/         scheduled/background jobs
    utils/        apiError, apiResponse, asyncHandler, cookies, crypto, dates, logger
  tests/  helpers/ (globalSetup, testApp, factories)  integration/  unit/
```

## Rules that cannot be broken
1. Audience trees (`modules/admin|user|public|webhook`) never import each other. Shared logic lives only in `domain/`.
2. Controllers are thin: read req -> call service -> send response. Business logic only in services/domain.
3. Every body/params/query goes through `validate()` with a Zod schema. One envelope (`utils/apiResponse`) and one error class (`utils/apiError`). Validation errors are `422 VALIDATION` with the first issue's message (the frontend shows it).
4. Every collection uses `defineModel`: UUID `_id` (exposed as `id`), `created_at`/`updated_at`, soft delete (`deletedAt`, filtered by the plugin). Delete with `Model.softDelete()`; unique indexes use `partialFilterExpression: ALIVE`. Only exception: `whatsapp_auth` (see DECISIONS). Field names are snake_case, the same as the old Postgres columns, because the pages read them.
5. Secrets only from env; keep `.env.example` in sync. Sensitive values are encrypted with `utils/crypto.encryptSecret` (AES-256-GCM). Never log or return them.
6. Admin permissions are RBAC (`domain/rbac/permissions.js`), checked in routes with `requirePermission()`, never inside services.
7. Every user-side query is scoped by `req.user.id`. One user must never see another's data (see `tests/integration/tenant-isolation.test.js`).
8. Side effects (messages, emails, payment webhooks) are idempotent, never run inside `withTransaction` (it can retry), and a webhook failure answers 500 so the provider retries.
9. Admin changes write `recordAudit()` inside the same transaction. Code that must not run twice at once takes `lockDoc()` first.
10. A feature is done only with: code + tests + `docs/STATUS.md` + `docs/DECISIONS.md` (if a decision was made) + Postman entry. Run `npm test` and hit the endpoint (through the Next app on :3000).
11. Keep new code small: no unneeded abstractions, comments or "future" features.

## Commands
```
npm run dev                  # API on PORT (default 4000); run `npm run dev` in the parent folder for the website
npm test                     # unit + integration (in-memory MongoDB replica set, no Atlas needed)
npm run test:unit
npm run lint
npm run seed:admin           # create/reset the super admin from SEED_ADMIN_*
POSTGRES_URL=... npm run migrate:from-postgres [-- --replace]
```
