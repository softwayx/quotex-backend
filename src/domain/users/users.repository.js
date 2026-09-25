import { withTransaction } from '../../config/database.js';
import { LOGIN_LOCK } from '../../config/constants.js';
import { generateReferralCode } from '../shared/referral.js';
import { RiskSettings, TrialUsage, User, toRow } from '../../models/index.js';
import { getActiveTrialPlan } from '../plans/plans.repository.js';
import { grantPlan } from '../subscriptions/subscriptions.js';

/** The fields pages and services may see. Never the password hash. */
export const PUBLIC_FIELDS =
  'username display_name currency language status created_at country_code country_source country_detected_at community_early_access';

export const findUserById = async (id, session) => toRow(await User.findById(id, PUBLIC_FIELDS, { session }).lean());

/** Which of username, WhatsApp number or email are already used by an account. */
export const findUserContactClash = async ({ username, phone, email }) => {
  const rows = await User.find({ $or: [{ username }, { phone }, { email: email.toLowerCase() }] }, 'username phone email').lean();
  return {
    username: rows.some((r) => r.username === username),
    phone: rows.some((r) => r.phone === phone),
    email: rows.some((r) => r.email?.toLowerCase() === email.toLowerCase()),
  };
};

export const findUserForLogin = async (username) =>
  toRow(await User.findOne({ username }, `${PUBLIC_FIELDS} email password_hash failed_attempts login_locked_until`).lean());

const uniqueReferralCode = async (session) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateReferralCode();
    if (!(await User.exists({ referral_code: code }).session(session))) return code;
  }
  throw new Error('Could not create a referral code.');
};

/** Creates the user with their risk settings row, trial usage and the active trial plan, atomically. */
export const createUser = ({ username, passwordHash, passwordEncrypted = null, displayName, phone = null, email = null, countryCode = null, onCreated = null }) =>
  withTransaction(async (session) => {
    const now = new Date();
    const [created] = await User.create(
      [
        {
          username,
          password_hash: passwordHash,
          password_encrypted: passwordEncrypted,
          display_name: displayName,
          terms_accepted_at: now,
          referral_code: await uniqueReferralCode(session),
          phone,
          email: email?.toLowerCase() ?? null,
          phone_verified_at: phone ? now : null,
          country_code: countryCode,
          country_source: countryCode ? 'PHONE' : null,
          country_detected_at: countryCode ? now : null,
        },
      ],
      { session },
    );
    await RiskSettings.create([{ user_id: created._id }], { session });
    await TrialUsage.create([{ user_id: created._id }], { session });

    // Every new account starts on the admin's active trial plan, if there is one.
    const trialPlan = await getActiveTrialPlan(session);
    if (trialPlan) await grantPlan({ userId: created._id, plan: trialPlan }, session);
    const user = await findUserById(created._id, session);
    if (onCreated) await onCreated(session, user);
    return user;
  });

const failedLoginUpdate = [
  {
    $set: {
      failed_attempts: { $add: ['$failed_attempts', 1] },
      login_locked_until: {
        $cond: [
          { $gte: [{ $add: ['$failed_attempts', 1] }, LOGIN_LOCK.MAX_FAILED_ATTEMPTS] },
          { $add: ['$$NOW', LOGIN_LOCK.LOCK_MINUTES * 60_000] },
          '$login_locked_until',
        ],
      },
    },
  },
];

/** Counts a wrong password; the 5th in a row locks the account for 15 minutes. Works for users and admins. */
export const recordFailedLogin = (Model, id) => Model.updateOne({ _id: id }, failedLoginUpdate, { updatePipeline: true });

export const clearFailedLogins = (Model, id) =>
  Model.updateOne({ _id: id }, { $set: { failed_attempts: 0, login_locked_until: null } });

export const savePasswordCopy = (id, passwordEncrypted) => User.updateOne({ _id: id }, { $set: { password_encrypted: passwordEncrypted } });

export const updateUserPreferences = async (userId, { language, currency }) => {
  const set = {};
  if (language) set.language = language;
  if (currency) set.currency = currency;
  const user = await User.findOneAndUpdate({ _id: userId }, { $set: set }, { returnDocument: 'after', projection: 'language currency', lean: true });
  return { language: user.language, currency: user.currency };
};
