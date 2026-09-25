import { randomBytes } from 'node:crypto';

// No 0/O/1/I so a code is easy to read out or type.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A short, readable referral code such as "K7QH4MZR". */
export const generateReferralCode = () =>
  Array.from(randomBytes(8), (byte) => ALPHABET[byte % ALPHABET.length]).join('');

/** Cleans a code typed or taken from a link. Returns null when it cannot be a code. */
export const normalizeReferralCode = (value) => {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(code) ? code : null;
};

/** "rahul_m" -> "ra***" so a friend's full username is not shown. */
export const maskUsername = (username) => `${String(username).slice(0, 2)}***`;
