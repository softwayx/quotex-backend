# Decisions

| # | Date | Decision | Why |
|---|---|---|---|
| 1 | 2026-09-24 | All backend logic moved from Next.js (`src/app/api`, `src/server`) into this Express API. Next.js is only the frontend. | Clear split between UI and API; WhatsApp sockets and payments live in one long-running process. |
| 2 | 2026-09-24 | JavaScript ESM, no TypeScript. | Team choice. ESM lets `domain/core` and `domain/shared` be copied from the old app unchanged. |
| 3 | 2026-09-24 | MongoDB Atlas + Mongoose (not Postgres/Sequelize). | Team choice. Atlas is a replica set, so multi-document transactions work. |
| 4 | 2026-09-24 | Documents keep the old Postgres column names (snake_case) and `_id` is the old UUID. | Pages and components read these fields (`display_name`, `duration_days`...), so the frontend needed no data changes, and the Postgres copy is 1:1 with the same ids. |
| 5 | 2026-09-24 | Soft delete on every collection via a Mongoose plugin (`deletedAt`), like Sequelize `paranoid`. Unique indexes only count live rows. Admin "delete user" soft-deletes the user and everything they own. | Nothing is lost; a deleted username/phone/email can sign up again. |
| 6 | 2026-09-24 | Exception: `whatsapp_auth` is hard-deleted. | Baileys rotates signal keys constantly; keeping deleted secret key material has no value and grows without limit. |
| 7 | 2026-09-24 | Row locks (`SELECT ... FOR UPDATE`) are replaced by `lockDoc()` (bump a hidden `lock_seq` inside the transaction). | A concurrent transaction on the same document gets a write conflict and Mongoose retries it after the first commits — same serialisation as before. |
| 8 | 2026-09-24 | Auth stays as in the old app: httpOnly cookie (`rc_session` / `sa_session`) with a JWT that holds only a server-side session id; bcrypt passwords; 5 failures -> 15 min lock. Same env secret names. | User's choice. Logout and "disable user" revoke instantly; with the same secrets and migrated `auth_sessions`, signed-in users stay signed in. |
| 9 | 2026-09-24 | The browser calls the API through a Next rewrite (`/api/v1/*` -> `BACKEND_URL`); server components call `BACKEND_URL` directly and forward the request cookies. | Cookies stay first-party on the website domain, no CORS. |
| 10 | 2026-09-24 | Routes: `/api/v1/user/*` (was `/api/auth`, `/api/session`...), `/api/v1/admin/*`, `/api/v1/public/*`, `/api/v1/webhook/razorpay` (was `/api/payments/razorpay/webhook`). | Audience-based structure. **Update the webhook URL in the Razorpay dashboard** when going live. |
| 11 | 2026-09-24 | Error envelope kept identical (`{ ok:false, error:{ code, message } }`, `VALIDATION` 422 with the first Zod message). | The forms show `error.message` unchanged. |
| 12 | 2026-09-24 | Redis dropped for now. | Nothing in the product needs it yet (login lock is on the user record, as before). |
| 13 | 2026-09-24 | Admin role field (`SUPER_ADMIN`) + permission per admin route group. | RBAC rule; every current admin is a super admin, so behaviour is unchanged. |
| 14 | 2026-09-24 | `src/core` stays in the frontend too (What-If calculator and live cards compute in the browser). The API's copy in `domain/core` is the one that enforces the rules. | Keep the two in sync when a rule changes. |
| 15 | 2026-09-24 | Default settings documents and the Free Trial / Basic / Pro plans are created by `seeders/defaults.js` on every start (only when missing). | Replaces the SQL migration seeds; never overwrites admin changes. |
| 16 | 2026-09-26 | Blog stored in MongoDB (`blogs`), written by the super admin (`blogs.manage`). Content HTML is sanitized with sanitize-html on every save; external links get rel="noopener". | One trusted place for content; the website renders it as-is. |
| 17 | 2026-09-26 | Blog images go to Cloudinary via a signed REST upload (no SDK). Type is checked from the file bytes, max 2 MB. | No local disk on the server/Lambda; Cloudinary resizes and serves images from a CDN. |
| 18 | 2026-09-26 | A slug changed after first publish is kept in `previous_slugs` and stays reserved; the website redirects it (308). | Old links and Google results keep working. |
| 19 | 2026-09-26 | Views are counted by `POST /public/blogs/:slug/view` from the reader's browser, not by `GET /public/blogs/:slug`. | The website caches post pages (ISR), so a server GET is not a visit. |
| 20 | 2026-09-26 | Fixed blog categories (Risk Management, Strategies, Beginner Guides, Hindi). | Stable category URLs (/blog/category/<slug>). Add new ones in `domain/blog/content.js` and `frontend/src/config/blog.js`. |
