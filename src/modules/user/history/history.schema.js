import { z } from 'zod';

export const HISTORY_RANGES = [7, 10, 30, 60, 90];

export const historyQuery = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((days) => HISTORY_RANGES.includes(days), 'Invalid range.')
    .default(7),
});

export const sessionParams = z.object({ sessionId: z.uuid() });
