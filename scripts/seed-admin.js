// Creates the super admin from SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD, or resets their password.
import env from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { hashPassword } from '../src/domain/auth/password.js';
import { Admin } from '../src/models/index.js';

const username = env.SEED_ADMIN_USERNAME?.toLowerCase();
const password = env.SEED_ADMIN_PASSWORD;
if (!username || !password) {
  console.error('Set SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD in backend/.env');
  process.exit(1);
}

await connectDatabase();
await Admin.syncIndexes();
await Admin.updateOne(
  { username },
  { $set: { password_hash: await hashPassword(password), failed_attempts: 0, login_locked_until: null }, $setOnInsert: { role: 'SUPER_ADMIN' } },
  { upsert: true },
);
await disconnectDatabase();
console.log(`Super admin "${username}" is ready.`);
