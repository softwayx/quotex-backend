import { z } from 'zod';
import { CALCULATOR_PATHS } from '../../../domain/blog/content.js';

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional().default(1).catch(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12).catch(12),
  category: z.string().trim().max(40).optional(),
  tag: z.string().trim().max(40).optional(),
  lang: z.enum(['en', 'hi']).optional(),
  calculator: z.enum(CALCULATOR_PATHS).optional(),
});

export const slugParams = z.object({ slug: z.string().trim().min(1).max(120) });
