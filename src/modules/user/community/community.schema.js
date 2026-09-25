import { z } from 'zod';

export const boardQuery = z.object({ minutes: z.coerce.number({ message: 'Invalid time window.' }).int('Invalid time window.') });
