import { AuditLog, Admin, DailyStat, Plan, Trade, TradingSession, TrialUsage, User, UserSubscription } from '../../../models/index.js';
import { decryptSecret } from '../../../utils/crypto.js';

export const USERS_PAGE_SIZE = 20;
export const AUDIT_PAGE_SIZE = 50;
const EXPIRING_DAYS = 7;
const DAY_MS = 86_400_000;

const USER_FIELDS =
  'username display_name currency language status created_at subscription_expires_at country_code country_source password_encrypted community_early_access';

const planState = (expiresAt, now) => (!expiresAt ? 'NONE' : new Date(expiresAt) > now ? 'ACTIVE' : 'EXPIRED');

const readPassword = (encrypted) => {
  try {
    return encrypted ? decryptSecret(encrypted) : null;
  } catch {
    return null;
  }
};

const planFilter = (plan, now) => {
  const soon = new Date(now.getTime() + EXPIRING_DAYS * DAY_MS);
  return {
    ACTIVE: { subscription_expires_at: { $gt: now } },
    EXPIRING: { subscription_expires_at: { $gt: now, $lte: soon } },
    EXPIRED: { subscription_expires_at: { $ne: null, $lte: now } },
    NONE: { subscription_expires_at: null },
  }[plan];
};

/** Escapes regex characters so a search for "a.b" is literal. */
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Adds plan state, current plan name, analyses used, session count and last trade to each user. */
const enrich = async (users, { withPassword }) => {
  if (users.length === 0) return [];
  const ids = users.map((u) => u._id);
  const [latestSubs, usage, sessions, lastTrades] = await Promise.all([
    UserSubscription.aggregate([
      { $match: { user_id: { $in: ids }, revoked_at: null } },
      { $sort: { created_at: -1 } },
      { $group: { _id: '$user_id', plan_id: { $first: '$plan_id' } } },
    ]),
    TrialUsage.find({ user_id: { $in: ids } }, 'user_id analyses_used').lean(),
    TradingSession.aggregate([{ $match: { user_id: { $in: ids } } }, { $group: { _id: '$user_id', n: { $sum: 1 } } }]),
    Trade.aggregate([{ $match: { user_id: { $in: ids } } }, { $group: { _id: '$user_id', at: { $max: '$created_at' } } }]),
  ]);
  const plans = new Map((await Plan.find({ _id: { $in: latestSubs.map((s) => s.plan_id) } }, 'name', { withDeleted: true }).lean()).map((p) => [p._id, p.name]));
  const planOf = new Map(latestSubs.map((s) => [s._id, plans.get(s.plan_id) ?? null]));
  const usageOf = new Map(usage.map((u) => [u.user_id, u.analyses_used]));
  const sessionsOf = new Map(sessions.map((s) => [s._id, s.n]));
  const lastTradeOf = new Map(lastTrades.map((t) => [t._id, t.at]));
  const now = new Date();

  return users.map(({ _id, password_encrypted: encrypted, ...user }) => ({
    id: _id,
    ...user,
    ...(withPassword && { password: readPassword(encrypted) }),
    plan_state: planState(user.subscription_expires_at, now),
    plan_name: planOf.get(_id) ?? null,
    analyses_used: usageOf.get(_id) ?? 0,
    sessions: sessionsOf.get(_id) ?? 0,
    last_trade_at: lastTradeOf.get(_id) ?? null,
  }));
};

/** Users with plan state, filtered and paginated. `plan`: ACTIVE | EXPIRING | EXPIRED | NONE. */
export const listUsers = async ({ q, status, plan, page = 1 }) => {
  const now = new Date();
  const filter = {};
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ username: pattern }, { display_name: pattern }];
  }
  if (status) filter.status = status;
  if (plan) Object.assign(filter, planFilter(plan, now));

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter, USER_FIELDS).sort({ created_at: -1 }).skip((page - 1) * USERS_PAGE_SIZE).limit(USERS_PAGE_SIZE).lean(),
  ]);
  return { rows: await enrich(users, { withPassword: true }), total, page, pageSize: USERS_PAGE_SIZE };
};

export const findUserDetail = async (userId) => {
  const user = await User.findById(userId, USER_FIELDS).lean();
  return user ? (await enrich([user], { withPassword: true }))[0] : null;
};

export const listUserSessions = async (userId) => {
  const sessions = await TradingSession.find({ user_id: userId }, 'status starting_capital target started_at closed_at').sort({ started_at: -1 }).limit(30).lean();
  const stats = new Map(
    (await DailyStat.find({ session_id: { $in: sessions.map((s) => s._id) } }, 'session_id total_trades wins losses net_pnl limit_reached').lean()).map((d) => [
      d.session_id,
      d,
    ]),
  );
  return sessions.map((s) => {
    const d = stats.get(s._id);
    return {
      id: s._id,
      status: s.status,
      starting_capital: s.starting_capital,
      target: s.target,
      started_at: s.started_at,
      closed_at: s.closed_at,
      total_trades: d?.total_trades ?? null,
      wins: d?.wins ?? null,
      losses: d?.losses ?? null,
      net_pnl: d?.net_pnl ?? null,
      limit_reached: d?.limit_reached ?? null,
    };
  });
};

export const listUserSubscriptions = async (userId) => {
  const subs = await UserSubscription.find({ user_id: userId }).sort({ created_at: -1 }).limit(20).lean();
  const plans = new Map((await Plan.find({ _id: { $in: subs.map((s) => s.plan_id) } }, 'name', { withDeleted: true }).lean()).map((p) => [p._id, p.name]));
  return subs.map((s) => ({
    id: s._id,
    starts_at: s.starts_at,
    expires_at: s.expires_at,
    revoked_at: s.revoked_at,
    created_at: s.created_at,
    plan_name: plans.get(s.plan_id) ?? null,
  }));
};

const toAuditRows = async (logs) => {
  const [admins, users] = await Promise.all([
    Admin.find({ _id: { $in: logs.map((l) => l.admin_id).filter(Boolean) } }, 'username', { withDeleted: true }).lean(),
    User.find({ _id: { $in: logs.map((l) => l.user_id).filter(Boolean) } }, 'username', { withDeleted: true }).lean(),
  ]);
  const adminName = new Map(admins.map((a) => [a._id, a.username]));
  const userName = new Map(users.map((u) => [u._id, u.username]));
  return logs.map((l) => ({
    id: l._id,
    action: l.action,
    details: l.details,
    created_at: l.created_at,
    admin_username: adminName.get(l.admin_id) ?? null,
    user_id: l.user_id,
    user_username: userName.get(l.user_id) ?? null,
  }));
};

export const listUserAudit = async (userId) => toAuditRows(await AuditLog.find({ user_id: userId }).sort({ created_at: -1 }).limit(20).lean());

export const listAudit = async ({ page = 1 }) => {
  const [total, logs] = await Promise.all([
    AuditLog.countDocuments(),
    AuditLog.find().sort({ created_at: -1 }).skip((page - 1) * AUDIT_PAGE_SIZE).limit(AUDIT_PAGE_SIZE).lean(),
  ]);
  return { rows: await toAuditRows(logs), total, page, pageSize: AUDIT_PAGE_SIZE };
};

export const getOverviewCounts = async () => {
  const now = new Date();
  const [users, activePlans, expiring, expired, suspended, sessions, trades] = await Promise.all([
    User.countDocuments(),
    User.countDocuments(planFilter('ACTIVE', now)),
    User.countDocuments(planFilter('EXPIRING', now)),
    User.countDocuments(planFilter('EXPIRED', now)),
    User.countDocuments({ status: 'SUSPENDED' }),
    TradingSession.countDocuments(),
    Trade.countDocuments(),
  ]);
  return { users, active_plans: activePlans, expiring, expired, suspended, sessions, trades };
};

export const listExpiringSoon = async (limit = 6) =>
  enrich(await User.find(planFilter('EXPIRING', new Date()), USER_FIELDS).sort({ subscription_expires_at: 1 }).limit(limit).lean(), { withPassword: false });

export const listRecentSignups = async (limit = 6) =>
  enrich(await User.find({}, USER_FIELDS).sort({ created_at: -1 }).limit(limit).lean(), { withPassword: false });
