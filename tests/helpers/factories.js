import { ACTORS } from '../../src/config/constants.js';
import { hashPassword } from '../../src/domain/auth/password.js';
import { startSession } from '../../src/domain/auth/sessions.js';
import { createUser as createUserWithTrial } from '../../src/domain/users/users.repository.js';
import { Admin, PaymentSettings, SINGLETON_ID } from '../../src/models/index.js';
import { encryptSecret } from '../../src/utils/crypto.js';

export const PASSWORD = 'Str0ng-pass!';

let seq = 0;
const next = () => (seq += 1);

/** A user created the real way: risk settings, trial usage and the trial plan included. */
export const createUser = async (overrides = {}) => {
  const n = next();
  return createUserWithTrial({
    username: overrides.username ?? `user${n}`,
    displayName: overrides.displayName ?? `User ${n}`,
    passwordHash: await hashPassword(overrides.password ?? PASSWORD),
    email: overrides.email ?? null,
    phone: overrides.phone ?? null,
    countryCode: overrides.countryCode ?? null,
  });
};

export const createAdmin = async (overrides = {}) => {
  const [admin] = await Admin.create([
    { username: overrides.username ?? `admin${next()}`, password_hash: await hashPassword(overrides.password ?? PASSWORD), role: overrides.role ?? 'SUPER_ADMIN' },
  ]);
  return { id: admin._id, username: admin.username };
};

/** Cookie header for a signed-in user / admin. */
export const userCookie = async (user) => `${ACTORS.USER.cookieName}=${await startSession(ACTORS.USER, user.id)}`;
export const adminCookie = async (admin) => `${ACTORS.ADMIN.cookieName}=${await startSession(ACTORS.ADMIN, admin.id)}`;

export const WEBHOOK_SECRET = 'whsec_test_123456';
export const KEY_SECRET = 'key_secret_test_123456';

export const configurePayments = () =>
  PaymentSettings.updateOne(
    { _id: SINGLETON_ID },
    {
      $set: {
        razorpay_key_id: 'rzp_test_abcdef123',
        razorpay_key_secret_enc: encryptSecret(KEY_SECRET),
        razorpay_webhook_secret_enc: encryptSecret(WEBHOOK_SECRET),
        enabled: true,
      },
    },
  );
