import { z } from 'zod';
import { normalizePhone } from '../../../domain/shared/phone.js';

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.]{3,30}$/, 'Username 3-30 characters: letters, numbers, _ or .');

const password = z.string().min(8, 'Password must be at least 8 characters.').max(72);

const phone = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) ctx.addIssue({ code: 'custom', message: 'Enter a valid WhatsApp number with country code.' });
    return normalized;
  });

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(120);

const otp = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.');

export const registerSchema = z.object({
  displayName: z.string().trim().min(2, 'Name is too short.').max(60),
  username,
  password,
  phone,
  email,
  acceptTerms: z.literal(true, { message: 'Please accept the Terms of Service and Privacy Policy.' }),
  // Optional code from an invite link. A wrong code is ignored, it never blocks sign-up.
  ref: z.string().trim().max(32).optional(),
});

export const registerVerifySchema = z.object({ registrationId: z.uuid(), code: otp });

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1).max(72),
});

export const loginVerifySchema = z.object({ challengeId: z.uuid(), code: otp });
