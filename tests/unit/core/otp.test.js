import { describe, expect, it } from '@jest/globals';
import { OTP_MAX_ATTEMPTS, OTP_MAX_SENDS, canSendOtp, generateOtp, otpExpiry, otpUsable } from '../../../src/domain/core/index.js';
import { maskEmail, maskPhone, normalizePhone, toJid } from '../../../src/domain/shared/phone.js';

const now = new Date('2026-09-24T10:00:00Z');

describe('otp', () => {
  it('generates a zero-padded 6-digit code', () => {
    expect(generateOtp(() => 42)).toBe('000042');
    expect(generateOtp(() => 999999)).toBe('999999');
  });

  it('is usable until it expires', () => {
    const record = { expires_at: otpExpiry(now), attempts: 0 };
    expect(otpUsable(record, now).ok).toBe(true);
    expect(otpUsable(record, new Date(now.getTime() + 11 * 60_000))).toEqual({ ok: false, reason: 'EXPIRED' });
  });

  it('is not usable after too many attempts or once used', () => {
    expect(otpUsable({ expires_at: otpExpiry(now), attempts: OTP_MAX_ATTEMPTS }, now).reason).toBe('TOO_MANY_ATTEMPTS');
    expect(otpUsable({ expires_at: otpExpiry(now), attempts: 0, consumed_at: now }, now).reason).toBe('USED');
    expect(otpUsable(null, now).reason).toBe('NOT_FOUND');
  });

  it('limits how many codes can be sent in a window', () => {
    expect(canSendOtp(OTP_MAX_SENDS - 1)).toBe(true);
    expect(canSendOtp(OTP_MAX_SENDS)).toBe(false);
  });
});

describe('phone helpers', () => {
  it('normalises numbers to digits with a country code', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('919876543210');
    expect(normalizePhone('+91 12345 67890')).toBeNull(); // Indian numbers start with 6-9
    expect(normalizePhone('0044 7911 123456')).toBe('447911123456');
  });
  it('rejects things that are not phone numbers', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });
  it('builds a JID and masks values', () => {
    expect(toJid('919876543210')).toBe('919876543210@s.whatsapp.net');
    expect(maskPhone('919876543210')).toBe('9198••••3210');
    expect(maskEmail('someone@mail.com')).toBe('so••••@mail.com');
  });
});
