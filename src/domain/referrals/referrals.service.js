import env from '../../config/env.js';
import { withTransaction } from '../../config/database.js';
import { Referral, ReferralSettings, SINGLETON_ID, User, lockDoc } from '../../models/index.js';
import { iso } from '../../utils/dates.js';
import { recordAudit } from '../audit/audit.service.js';
import { maskUsername, normalizeReferralCode } from '../shared/referral.js';
import { addBonusDays } from '../subscriptions/subscriptions.js';

const mapSettings = (doc) => ({
  enabled: doc.enabled,
  referrerDays: doc.referrer_days,
  refereeDays: doc.referee_days,
  trigger: doc.reward_trigger,
  maxRewards: doc.max_rewards,
  updatedAt: doc.updated_at,
});

export const getReferralSettings = async (session) => mapSettings(await ReferralSettings.findById(SINGLETON_ID, null, { session }).lean());

const findUserByReferralCode = (code, session) => User.findOne({ referral_code: code }, 'username', { session }).lean();

/** Gives the referrer their days, unless they already earned the maximum. */
const rewardReferrer = async (session, referral) => {
  const settings = await getReferralSettings(session);
  const rewarded = await Referral.countDocuments({ referrer_id: referral.referrer_id, status: 'REWARDED' }).session(session);
  const status = rewarded >= settings.maxRewards ? 'CAPPED' : 'REWARDED';
  if (status === 'REWARDED' && referral.referrer_days > 0) await addBonusDays(session, referral.referrer_id, referral.referrer_days);
  await Referral.updateOne({ _id: referral.id }, { $set: { status, rewarded_at: new Date() } }, { session });
};

/**
 * Called inside the sign-up transaction. A valid code links the new user to the referrer and gives the new
 * user their extra days; the referrer is rewarded now or on the friend's first payment, as the admin chose.
 * A wrong or unknown code never blocks sign-up.
 */
export const applyReferralAtSignup = async (session, newUser, rawCode) => {
  const code = normalizeReferralCode(rawCode);
  if (!code) return null;
  const settings = await getReferralSettings(session);
  if (!settings.enabled) return null;
  const referrer = await findUserByReferralCode(code, session);
  if (!referrer || referrer._id === newUser.id) return null;

  await User.updateOne({ _id: newUser.id }, { $set: { referred_by: referrer._id } }, { session });
  const [referral] = await Referral.create(
    [{ referrer_id: referrer._id, referee_id: newUser.id, referrer_days: settings.referrerDays, referee_days: settings.refereeDays }],
    { session },
  );
  if (settings.refereeDays > 0) await addBonusDays(session, newUser.id, settings.refereeDays);
  if (settings.trigger === 'SIGNUP') {
    await rewardReferrer(session, { id: referral._id, referrer_id: referrer._id, referrer_days: settings.referrerDays });
  }
  return referrer;
};

/** Called when a payment succeeds: the friend's first payment rewards the person who invited them. */
export const rewardOnFirstPayment = async (session, userId) => {
  const referral = await lockDoc(Referral, { referee_id: userId, status: 'PENDING' }, session);
  if (referral) await rewardReferrer(session, referral);
};

const STATUS_TEXT = { PENDING: 'Waiting for reward', REWARDED: 'Rewarded', CAPPED: 'Limit reached' };

const usernamesOf = async (ids) =>
  new Map((await User.find({ _id: { $in: ids } }, 'username', { withDeleted: true }).lean()).map((u) => [u._id, u.username]));

/** Everything the "Refer and earn" page needs. */
export const getReferralView = async (userId) => {
  const [settings, user, rows] = await Promise.all([
    getReferralSettings(),
    User.findById(userId, 'referral_code').lean(),
    Referral.find({ referrer_id: userId }).sort({ created_at: -1 }).limit(50).lean(),
  ]);
  const all = await Referral.find({ referrer_id: userId }, 'status referrer_days').lean();
  const rewarded = all.filter((r) => r.status === 'REWARDED');
  const names = await usernamesOf(rows.map((r) => r.referee_id));
  const code = user?.referral_code ?? null;
  return {
    settings,
    code,
    link: `${env.SITE_URL.replace(/\/+$/, '')}/risk-calculator/register?ref=${code}`,
    totals: { joined: all.length, rewarded: rewarded.length, daysEarned: rewarded.reduce((sum, r) => sum + r.referrer_days, 0) },
    friends: rows.map((row) => ({
      id: row._id,
      name: maskUsername(names.get(row.referee_id) ?? ''),
      status: row.status,
      statusText: STATUS_TEXT[row.status],
      days: row.status === 'REWARDED' ? row.referrer_days : 0,
      joinedAt: iso(row.created_at),
    })),
  };
};

/** For the sign-up page: is this code valid, and what does the new user get? */
export const getInviteInfo = async (rawCode) => {
  const code = normalizeReferralCode(rawCode);
  if (!code) return null;
  const [settings, referrer] = await Promise.all([getReferralSettings(), findUserByReferralCode(code)]);
  if (!settings.enabled || !referrer) return null;
  return { code, refereeDays: settings.refereeDays };
};

export const getReferralAdminView = async () => {
  const [settings, all, recent] = await Promise.all([
    getReferralSettings(),
    Referral.find({}, 'status referrer_days referee_days').lean(),
    Referral.find().sort({ created_at: -1 }).limit(50).lean(),
  ]);
  const rewarded = all.filter((r) => r.status === 'REWARDED');
  const names = await usernamesOf(recent.flatMap((r) => [r.referrer_id, r.referee_id]));
  return {
    settings: { ...settings, updatedAt: iso(settings.updatedAt) },
    totals: {
      total: all.length,
      pending: all.filter((r) => r.status === 'PENDING').length,
      rewarded: rewarded.length,
      daysGiven: rewarded.reduce((sum, r) => sum + r.referrer_days + r.referee_days, 0),
    },
    recent: recent.map((r) => ({
      id: r._id,
      status: r.status,
      referrer_days: r.referrer_days,
      referee_days: r.referee_days,
      created_at: iso(r.created_at),
      referrer: names.get(r.referrer_id),
      referee: names.get(r.referee_id),
    })),
  };
};

export const updateReferralSettings = (adminId, input) =>
  withTransaction(async (session) => {
    const before = await getReferralSettings(session);
    const doc = await ReferralSettings.findOneAndUpdate(
      { _id: SINGLETON_ID },
      {
        $set: {
          enabled: input.enabled,
          referrer_days: input.referrerDays,
          referee_days: input.refereeDays,
          reward_trigger: input.trigger,
          max_rewards: input.maxRewards,
          updated_by: adminId,
        },
      },
      { returnDocument: 'after', session, lean: true },
    );
    const after = mapSettings(doc);
    await recordAudit(
      { adminId, action: 'REFERRAL_SETTINGS_UPDATED', details: { from: { ...before, updatedAt: undefined }, to: { ...after, updatedAt: undefined } } },
      session,
    );
    return after;
  });
