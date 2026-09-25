import { z } from 'zod';

export const auditQuery = z.object({ page: z.coerce.number().int().min(1).optional().default(1).catch(1) });
