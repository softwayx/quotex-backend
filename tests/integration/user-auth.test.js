import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import env from '../../src/config/env.js';
import { createPendingRegistration } from '../../src/domain/auth/otp.repository.js';
import { hashPassword } from '../../src/domain/auth/password.js';
import { AuthSession, Referral, RiskSettings, TrialUsage, User, UserSubscription } from '../../src/models/index.js';
import { hmacSha256Hex } from '../../src/utils/crypto.js';
import { PASSWORD, createUser, userCookie } from '../helpers/factories.js';
import { api, closeDb, resetDb, setupDb } from '../helpers/testApp.js';

beforeAll(setupDb);
beforeEach(resetDb);
afterAll(closeDb);

const login = (username, password = PASSWORD) => api().post('/api/v1/user/auth/login').send({ username, password });
const cookieOf = (res) => res.headers['set-cookie']?.find((c) => c.startsWith('rc_session='))?.split(';')[0];

describe('user login', () => {
  it('signs in a user without email, sets the session and language cookies', async () => {
    const user = await createUser();
    const res = await login(user.username.toUpperCase());
    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({ id: user.id, username: user.username, displayName: user.display_name });
    expect(res.headers['set-cookie'].join(';')).toMatch(/rc_session=.+HttpOnly/);
    expect(res.headers['set-cookie'].join(';')).toContain('lang=en');

    const me = await api().get('/api/v1/user/account/me').set('Cookie', cookieOf(res));
    expect(me.status).toBe(200);
    expect(me.body.data.user.id).toBe(user.id);
    expect(me.body.data.user.password_hash).toBeUndefined();
    expect(me.body.data.plan).toEqual(expect.objectContaining({ planName: 'Free Trial', isTrial: true }));
  });

  it('uses one message for a wrong password and an unknown user', async () => {
    const user = await createUser();
    const wrong = await login(user.username, 'nope-nope');
    const unknown = await login('nobody');
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toEqual(unknown.body.error);
  });

  it('locks the account for 15 minutes after 5 wrong passwords', async () => {
    const user = await createUser();
    for (let i = 0; i < 5; i += 1) await login(user.username, 'nope-nope');
    const res = await login(user.username);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('refuses suspended and soft-deleted users', async () => {
    const suspended = await createUser();
    await User.updateOne({ _id: suspended.id }, { $set: { status: 'SUSPENDED' } });
    expect((await login(suspended.username)).status).toBe(403);

    const deleted = await createUser();
    await User.softDelete({ _id: deleted.id });
    expect((await login(deleted.username)).status).toBe(401);
  });

  it('logout revokes the server-side session', async () => {
    const user = await createUser();
    const cookie = await userCookie(user);
    expect((await api().post('/api/v1/user/auth/logout').set('Cookie', cookie)).status).toBe(200);
    expect((await api().get('/api/v1/user/account/me').set('Cookie', cookie)).status).toBe(401);
    expect(await AuthSession.countDocuments({ actor_id: user.id, revoked_at: { $ne: null } })).toBe(1);
  });
});

describe('sign-up verification', () => {
  const pending = async (overrides = {}) =>
    createPendingRegistration({
      displayName: 'Asha Rao',
      username: 'asha',
      passwordHash: await hashPassword(PASSWORD),
      passwordEncrypted: null,
      phone: '919876543210',
      email: 'Asha@Example.com',
      otpHash: hmacSha256Hex(env.APP_ENCRYPTION_KEY, 'otp:123456'),
      expiresAt: new Date(Date.now() + 600_000),
      ...overrides,
    });

  it('a correct code creates the account with trial, settings and country from the phone', async () => {
    const registrationId = await pending();
    const wrong = await api().post('/api/v1/user/auth/register/verify').send({ registrationId, code: '000000' });
    expect(wrong.body.error.code).toBe('OTP_WRONG');

    const res = await api().post('/api/v1/user/auth/register/verify').send({ registrationId, code: '123456' });
    expect(res.status).toBe(201);
    expect(res.body.data.user).toEqual({ username: 'asha', displayName: 'Asha Rao' });
    expect(cookieOf(res)).toBeTruthy();

    const user = await User.findOne({ username: 'asha' }).lean();
    expect(user).toEqual(expect.objectContaining({ country_code: 'IN', country_source: 'PHONE', email: 'asha@example.com' }));
    expect(user.referral_code).toMatch(/^[A-Z0-9]{8}$/);
    expect(await RiskSettings.countDocuments({ user_id: user._id })).toBe(1);
    expect(await TrialUsage.countDocuments({ user_id: user._id })).toBe(1);
    expect(await UserSubscription.countDocuments({ user_id: user._id })).toBe(1);

    const again = await api().post('/api/v1/user/auth/register/verify').send({ registrationId, code: '123456' });
    expect(again.body.error.code).toBe('OTP_INVALID');
  });

  it('an invite code links the friend and gives them the extra days', async () => {
    const inviter = await createUser();
    const { referral_code: code } = await User.findById(inviter.id).lean();
    const registrationId = await pending({ ref: code.toLowerCase() });

    await api().post('/api/v1/user/auth/register/verify').send({ registrationId, code: '123456' }).expect(201);
    const friend = await User.findOne({ username: 'asha' }).lean();
    expect(friend.referred_by).toBe(inviter.id);
    expect(await Referral.findOne({ referee_id: friend._id }).lean()).toEqual(expect.objectContaining({ status: 'PENDING', referee_days: 3 }));
    // 7-day trial extended by the 3 referee days.
    const days = (new Date(friend.subscription_expires_at) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(9.9);

    const invite = await api().get(`/api/v1/public/invite?ref=${code}`);
    expect(invite.body.data.invite).toEqual({ code, refereeDays: 3 });
  });
});
