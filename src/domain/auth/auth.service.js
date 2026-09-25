import { randomInt } from 'node:crypto';
import env from '../../config/env.js';
import { ACTORS } from '../../config/constants.js';
import { Admin, User } from '../../models/index.js';
import ApiError from '../../utils/apiError.js';
import { encryptSecret, hmacSha256Hex, safeEqualHex } from '../../utils/crypto.js';
import { canSendOtp, generateOtp, otpExpiry, otpUsable } from '../core/index.js';
import { sendOtpEmail } from '../messaging/email.service.js';
import { sendRegistrationOtp } from '../messaging/whatsapp.service.js';
import { applyReferralAtSignup } from '../referrals/referrals.service.js';
import { countryFromPhone, maskEmail, maskPhone } from '../shared/phone.js';
import { findAdminForLogin } from '../users/admins.repository.js';
import {
  clearFailedLogins,
  createUser,
  findUserById,
  findUserContactClash,
  findUserForLogin,
  recordFailedLogin,
  savePasswordCopy,
} from '../users/users.repository.js';
import * as otp from './otp.repository.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password.js';
import { startSession } from './sessions.js';

// One message for every credential failure so accounts cannot be enumerated.
const invalidCredentials = () => new ApiError('INVALID_CREDENTIALS', 'Wrong username or password.', 401);
const tooManyAttempts = () => new ApiError('TOO_MANY_ATTEMPTS', 'Too many attempts. Try again in a few minutes.', 429);

const isLocked = (record) => record?.login_locked_until && new Date(record.login_locked_until) > new Date();

/** Shared credential check for users and admins. `Model` is the collection the record came from. */
const authenticate = async (Model, record, password) => {
  if (isLocked(record)) throw tooManyAttempts();
  const valid = await verifyPassword(password, record?.password_hash ?? DUMMY_HASH);
  if (!record || !valid) {
    if (record) await recordFailedLogin(Model, record.id);
    throw invalidCredentials();
  }
  await clearFailedLogins(Model, record.id);
};

const hashOtp = (code) => hmacSha256Hex(env.APP_ENCRYPTION_KEY, `otp:${code}`);
const codeMatches = (code, otpHash) => safeEqualHex(hashOtp(code), otpHash);

const otpFailure = (reason) => {
  if (reason === 'EXPIRED') return new ApiError('OTP_EXPIRED', 'This code has expired. Please start again.', 400);
  if (reason === 'TOO_MANY_ATTEMPTS') return new ApiError('OTP_LOCKED', 'Too many wrong codes. Please start again.', 429);
  return new ApiError('OTP_INVALID', 'This code is not valid. Please start again.', 400);
};
const wrongCode = () => new ApiError('OTP_WRONG', 'That code is not correct.', 400);

const clashError = (clash) => {
  if (clash.username) return ApiError.conflict('USERNAME_TAKEN', 'This username is already taken.');
  if (clash.phone) return ApiError.conflict('PHONE_TAKEN', 'This WhatsApp number is already registered.');
  if (clash.email) return ApiError.conflict('EMAIL_TAKEN', 'This email is already registered.');
  return null;
};

/** `{ user, token }` where `token` goes into the session cookie. */
const signedIn = async (user, userAgent) => ({ user, token: await startSession(ACTORS.USER, user.id, userAgent) });

/** Step 1 of sign-up: checks the details, parks them, and sends a one-time code to the WhatsApp number. */
export const startRegistration = async ({ displayName, username, password, phone, email, ref }) => {
  const clash = clashError(await findUserContactClash({ username, phone, email }));
  if (clash) throw clash;
  if (!canSendOtp(await otp.countRecentRegistrations(phone))) throw tooManyAttempts();

  const code = generateOtp(randomInt);
  await sendRegistrationOtp(phone, code, displayName);
  const registrationId = await otp.createPendingRegistration({
    displayName,
    username,
    passwordHash: await hashPassword(password),
    passwordEncrypted: encryptSecret(password),
    phone,
    email,
    ref,
    otpHash: hashOtp(code),
    expiresAt: otpExpiry(),
  });
  return { registrationId, phoneHint: maskPhone(phone) };
};

/** Step 2 of sign-up: a correct WhatsApp code creates the account and signs the user in. */
export const verifyRegistration = async ({ registrationId, code }, userAgent) => {
  const pending = await otp.findPendingRegistration(registrationId);
  const usable = otpUsable(pending);
  if (!usable.ok) throw otpFailure(usable.reason);
  if (!codeMatches(code, pending.otp_hash)) {
    await otp.bumpPendingAttempts(registrationId);
    throw wrongCode();
  }
  const clash = await findUserContactClash({ username: pending.username, phone: pending.phone, email: pending.email });
  if (clash.username) throw ApiError.conflict('USERNAME_TAKEN', 'This username is already taken.');
  if (clash.phone || clash.email) throw ApiError.conflict('CONTACT_TAKEN', 'This number or email is already registered.');

  const user = await createUser({
    username: pending.username,
    displayName: pending.display_name,
    passwordHash: pending.password_hash,
    passwordEncrypted: pending.password_encrypted,
    phone: pending.phone,
    countryCode: countryFromPhone(pending.phone),
    email: pending.email,
    // A referral code from the invite link links the new user to whoever invited them.
    onCreated: (session, created) => applyReferralAtSignup(session, created, pending.ref),
  });
  await otp.deletePendingRegistration(registrationId);
  return signedIn(user, userAgent);
};

/**
 * Checks the password. Users with an email get a code by email and no session yet
 * (`{ otpRequired, challengeId }`); older users without one are signed in directly.
 */
export const loginUser = async ({ username, password }, userAgent) => {
  const record = await findUserForLogin(username);
  await authenticate(User, record, password);
  if (record.status !== 'ACTIVE') throw ApiError.forbidden('This account is suspended.');
  await savePasswordCopy(record.id, encryptSecret(password));

  if (record.email) {
    if (!canSendOtp(await otp.countRecentChallenges(record.id))) throw tooManyAttempts();
    const code = generateOtp(randomInt);
    await sendOtpEmail(record.email, code, record.display_name);
    const challengeId = await otp.createLoginChallenge({ userId: record.id, otpHash: hashOtp(code), expiresAt: otpExpiry() });
    return { result: { otpRequired: true, challengeId, emailHint: maskEmail(record.email) } };
  }
  const { token } = await signedIn(record, userAgent);
  return { result: { id: record.id, username: record.username, displayName: record.display_name }, token, language: record.language };
};

/** Second login step: the emailed code opens the session. */
export const verifyLoginOtp = async ({ challengeId, code }, userAgent) => {
  const challenge = await otp.findLoginChallenge(challengeId);
  const usable = otpUsable(challenge);
  if (!usable.ok) throw otpFailure(usable.reason);
  if (!codeMatches(code, challenge.otp_hash)) {
    await otp.bumpChallengeAttempts(challengeId);
    throw wrongCode();
  }
  await otp.consumeChallenge(challengeId);
  const user = await findUserById(challenge.user_id);
  if (!user || user.status !== 'ACTIVE') throw ApiError.forbidden('This account is suspended.');
  return signedIn(user, userAgent);
};

export const loginAdmin = async ({ username, password }, userAgent) => {
  const record = await findAdminForLogin(username);
  await authenticate(Admin, record, password);
  return { admin: { id: record.id, username: record.username }, token: await startSession(ACTORS.ADMIN, record.id, userAgent) };
};

