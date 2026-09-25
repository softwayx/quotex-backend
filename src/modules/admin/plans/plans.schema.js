import { z } from 'zod';

const price = z.coerce.number({ message: 'Enter a price.' }).min(0).max(1_000_000);

export const planIdParams = z.object({ id: z.uuid() });

export const listPlansQuery = z.object({ activeOnly: z.stringbool().optional().default(false).catch(false) });

/**
 * Basic and Pro are fixed plans. The admin only sets how long they last, what they cost in
 * rupees (India) and in dollars (everywhere else), and whether they are on sale.
 */
export const updatePlanSchema = z
  .object({
    durationDays: z.coerce.number().int().min(1).max(3650).optional(),
    priceInr: price.optional(),
    priceUsd: price.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

/** { BASIC: { feature_key: bool }, PRO: { ... } }. Unknown keys are ignored when saved. */
export const planFeaturesSchema = z.object({
  BASIC: z.record(z.string(), z.boolean()),
  PRO: z.record(z.string(), z.boolean()),
});
