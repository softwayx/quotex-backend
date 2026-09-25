import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1).max(72),
});
