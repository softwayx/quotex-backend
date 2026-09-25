import { z } from 'zod';

const phone = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .refine((value) => value === '' || /^\+?[0-9]{8,15}$/.test(value), 'Enter a valid phone number, e.g. +919876543210.');

export const createOrderSchema = z
  .object({
    planId: z.uuid(),
    currency: z.enum(['INR', 'USD', 'GBP', 'EUR', 'AED']),
    email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(120),
    phone: phone.optional().default(''),
  })
  .refine((v) => v.currency === 'INR' || v.phone !== '', {
    path: ['phone'],
    message: 'A valid phone number is required for international payments.',
  });

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(5).max(64),
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_signature: z.string().min(20).max(256),
});
