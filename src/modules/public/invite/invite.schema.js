import { z } from 'zod';

export const inviteQuery = z.object({ ref: z.string().trim().max(32).optional() });
