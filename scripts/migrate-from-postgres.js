/**
 * One-off copy of the old Postgres data into MongoDB, keeping every UUID so links, sessions and
 * cookies stay valid. Usage:
 *   POSTGRES_URL=postgresql://user:pass@localhost:5432/risk_calculator npm run migrate:from-postgres [-- --replace]
 * Refuses to write into non-empty collections unless --replace is given (which empties them first).
 * APP_ENCRYPTION_KEY and the session secrets in backend/.env must be the old app's values, otherwise
 * saved payment/email secrets cannot be decrypted and users must log in again.
 */
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import pg from 'pg';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { SINGLETON_ID } from '../src/models/index.js';

const POSTGRES_URL = process.env.POSTGRES_URL;
const replace = process.argv.includes('--replace');
if (!POSTGRES_URL) {
  console.error('Set POSTGRES_URL to the old database, e.g. postgresql://postgres:PASSWORD@localhost:5432/risk_calculator');
  process.exit(1);
}

// NUMERIC and BIGINT as numbers, DATE as its 'YYYY-MM-DD' text.
pg.types.setTypeParser(1700, parseFloat);
pg.types.setTypeParser(20, Number);
pg.types.setTypeParser(1082, (value) => value);

const client = new pg.Client({ connectionString: POSTGRES_URL });
await client.connect();
await connectDatabase();
const db = mongoose.connection.db;

const rows = async (sql) => (await client.query(sql)).rows;
const tableExists = async (table) => (await rows(`SELECT to_regclass('public.${table}') AS t`))[0].t !== null;

/** Old row -> document: keeps the id as `_id`, fills both timestamps, marks it not deleted. */
const toDoc = (row, { id = row.id ?? randomUUID(), drop = [] } = {}) => {
  const doc = { ...row };
  for (const key of ['id', ...drop]) delete doc[key];
  const created = row.created_at ?? row.updated_at ?? row.received_at ?? row.fetched_at ?? new Date();
  return { _id: id, ...doc, created_at: created, updated_at: row.updated_at ?? created, deletedAt: null };
};

const copy = async (collection, docs) => {
  const target = db.collection(collection);
  if (replace) await target.deleteMany({});
  else if ((await target.countDocuments()) > 0) throw new Error(`"${collection}" already has data. Re-run with --replace to overwrite it.`);
  if (docs.length) await target.insertMany(docs, { ordered: true });
  console.log(`${collection.padEnd(24)} ${docs.length}`);
};

const simple = async (table, collection = table, options = {}) => {
  if (!(await tableExists(table))) return console.log(`${collection.padEnd(24)} (no table, skipped)`);
  await copy(collection, (await rows(`SELECT * FROM ${table}`)).map((row) => toDoc(row, options)));
};

const singleton = async (table) => {
  const [row] = await rows(`SELECT * FROM ${table}`);
  await copy(table, row ? [toDoc(row, { id: SINGLETON_ID })] : []);
};

await copy(
  'users',
  (await rows('SELECT * FROM users')).map((row) => toDoc({ ...row, email: row.email?.toLowerCase() ?? null })),
);
await copy('admins', (await rows('SELECT * FROM admins')).map((row) => toDoc({ ...row, role: 'SUPER_ADMIN' })));
await simple('auth_sessions');
await simple('trial_usage');
await simple('risk_settings');
await simple('trading_sessions');
await simple('trades');
await simple('daily_stats');
await simple('user_subscriptions');
await copy('admin_audit_log', (await rows('SELECT * FROM admin_audit_log')).map((row) => toDoc(row, { id: randomUUID() })));

const prices = await rows('SELECT plan_id, currency, amount FROM plan_prices ORDER BY currency');
await copy(
  'plans',
  (await rows('SELECT * FROM plans')).map((row) =>
    toDoc({ ...row, prices: prices.filter((p) => p.plan_id === row.id).map(({ currency, amount }) => ({ currency, amount })) }),
  ),
);

await simple('payments');
await copy('payment_webhook_events', (await rows('SELECT * FROM payment_webhook_events')).map((row) => toDoc(row, { drop: ['received_at'] })));
await copy('exchange_rates', (await rows('SELECT * FROM exchange_rates')).map((row) => toDoc(row)));
await copy('plan_features', (await rows('SELECT * FROM plan_features')).map((row) => toDoc(row)));
await simple('referrals');
await simple('pending_registrations');
await simple('login_challenges');
await simple('whatsapp_sessions');
await copy('whatsapp_auth', (await rows('SELECT * FROM whatsapp_auth')).map((row) => toDoc(row)));
for (const table of ['recommended_settings', 'payment_settings', 'referral_settings', 'app_settings', 'messaging_settings']) {
  await singleton(table);
}

await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
await client.end();
await disconnectDatabase();
console.log('Done. Start the API; it adds any missing defaults but never overwrites copied data.');
