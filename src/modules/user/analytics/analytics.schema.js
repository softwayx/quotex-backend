import { z } from 'zod';

/** Unknown ranges fall back to the default inside the service, like the old page did. */
export const insightsQuery = z.object({ days: z.coerce.number().int().optional().catch(undefined) });
