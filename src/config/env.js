import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (process.env.NODE_ENV !== 'test') dotenv.config({ path: path.join(root, '.env'), quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, 'must be a mongodb:// or mongodb+srv:// URI'),
  /** Public address of the website (Next app). Used for referral links and the webhook URL. */
  SITE_URL: z.url().default('http://localhost:3000'),
  USER_SESSION_SECRET: z.string().min(32),
  ADMIN_SESSION_SECRET: z.string().min(32),
  /** 32 bytes as 64 hex characters. Encrypts secrets stored in the database. Same key as the old app. */
  APP_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'must be 64 hex characters (32 bytes)'),
  /** Starts the WhatsApp sockets on boot. Off in tests. */
  WHATSAPP_ENABLED: z.stringbool().default(true),
  SEED_ADMIN_USERNAME: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment:\n${issues}`);
  process.exit(1);
}

const env = Object.freeze({
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
});

export default env;
