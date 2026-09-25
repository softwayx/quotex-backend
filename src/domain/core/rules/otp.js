export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
/** At most this many codes may be sent to one target inside `OTP_SEND_WINDOW_MINUTES`. */
export const OTP_MAX_SENDS = 3;
export const OTP_SEND_WINDOW_MINUTES = 10;

/** Random 6-digit code from a random integer supplier (injected so it is testable). */
export const generateOtp = (randomInt) => String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');

export const otpExpiry = (now = new Date()) => new Date(now.getTime() + OTP_TTL_MINUTES * 60_000);

/**
 * Whether a stored challenge can still be tried.
 * `record`: { expires_at, attempts, consumed_at? }. Returns { ok } or { ok: false, reason }.
 */
export const otpUsable = (record, now = new Date()) => {
  if (!record) return { ok: false, reason: 'NOT_FOUND' };
  if (record.consumed_at) return { ok: false, reason: 'USED' };
  if (new Date(record.expires_at) <= now) return { ok: false, reason: 'EXPIRED' };
  if (record.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
  return { ok: true };
};

/** True when another code may be sent, given how many were already sent in the recent window. */
export const canSendOtp = (sentInWindow) => sentInWindow < OTP_MAX_SENDS;
