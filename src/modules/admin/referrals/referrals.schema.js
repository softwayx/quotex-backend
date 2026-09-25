import { z } from 'zod';

export const referralSettingsSchema = z.object({
  enabled: z.boolean(),
  referrerDays: z.coerce.number().int().min(0).max(365),
  refereeDays: z.coerce.number().int().min(0).max(365),
  trigger: z.enum(['SIGNUP', 'FIRST_PAYMENT']),
  maxRewards: z.coerce.number().int().min(1).max(1000),
});
