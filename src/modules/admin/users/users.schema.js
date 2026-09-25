import { z } from 'zod';

const MAX_DAYS = 3650;

export const userIdParams = z.object({ id: z.uuid('Invalid user id.') });

export const listUsersQuery = z.object({
  q: z.string().trim().max(60).optional().default(''),
  plan: z.enum(['', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'NONE']).optional().default('').catch(''),
  status: z.enum(['', 'ACTIVE', 'SUSPENDED']).optional().default('').catch(''),
  page: z.coerce.number().int().min(1).optional().default(1).catch(1),
});

export const assignPlanSchema = z.object({
  planId: z.uuid('Choose a plan.'),
  /** REPLACE starts now; STACK starts when the current period ends. */
  mode: z.enum(['REPLACE', 'STACK']).default('REPLACE'),
});

export const adjustExpirySchema = z
  .object({
    days: z.coerce.number().int().min(-MAX_DAYS).max(MAX_DAYS).optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.')
      .optional(),
  })
  .refine((v) => (v.days !== undefined) !== (v.date !== undefined), 'Provide either days or a date.')
  .refine((v) => v.days === undefined || v.days !== 0, 'Days cannot be 0.');

export const userStatusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) });

export const unlockSchema = z.object({ reason: z.string().trim().max(200).optional() });

export const communityAccessSchema = z.object({ granted: z.boolean() });

export const countrySchema = z.object({ countryCode: z.string().trim().length(2, 'Choose a country.') });
