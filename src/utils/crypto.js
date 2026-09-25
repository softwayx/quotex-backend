import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import env from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

const key = () => Buffer.from(env.APP_ENCRYPTION_KEY, 'hex');

/** AES-256-GCM. Output: `v1:<iv>:<tag>:<ciphertext>` (base64 parts), the same format as the old app. */
export const encryptSecret = (plain) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
};

/** Reverses encryptSecret. Throws if the value was tampered with or the key is wrong. */
export const decryptSecret = (stored) => {
  const [version, iv, tag, data] = String(stored).split(':');
  if (version !== VERSION || !iv || !tag || !data) throw new Error('Unsupported secret format.');
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
};

export const hmacSha256Hex = (secret, message) => createHmac('sha256', secret).update(message).digest('hex');

/** Constant-time comparison of two hex signatures. */
export const safeEqualHex = (a, b) => {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
};
