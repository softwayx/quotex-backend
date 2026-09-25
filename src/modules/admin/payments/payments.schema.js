import { z } from 'zod';

/** Razorpay credentials. Secrets are optional so saving other fields never wipes them. */
export const paymentSettingsSchema = z.object({
  keyId: z
    .string()
    .trim()
    .regex(/^rzp_(test|live)_[A-Za-z0-9]{6,}$/, 'Key ID should look like rzp_test_xxxxxxxx or rzp_live_xxxxxxxx.')
    .optional()
    .or(z.literal('')),
  keySecret: z.string().trim().min(8, 'Key secret looks too short.').max(200).optional().or(z.literal('')),
  webhookSecret: z.string().trim().min(6, 'Webhook secret looks too short.').max(200).optional().or(z.literal('')),
  enabled: z.boolean().optional(),
  /** Public website address, used to build the webhook URL. Empty clears it. */
  siteUrl: z.string().trim().max(200).optional(),
});
