# Requirements

**Product:** RiskQuo — a risk-management and analytics tool for traders. It sizes trades, tracks a daily session and stops the user when their own limits are reached. No signals, no predictions, no trade execution.

**Actors**
- **Super Admin** — users, plans and prices, plan features, recommended settings, lock hours, community switch, referrals, Razorpay, email/WhatsApp OTP, audit log. Can never bypass a user's protected-settings lock.
- **User (trader)** — signs up with a WhatsApp code, logs in (email code when an email is saved), runs daily sessions, records trades, sees history/analytics/insights, buys a plan, invites friends.
- **Anonymous** — public website, invite check, health.
- **Webhook** — Razorpay payment events.

The full product rules (calculations, safety lock, profit protection, accuracy guard, plans, payments) are in `../architecture.md`; they are enforced by `src/domain/`.
