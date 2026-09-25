import { z } from 'zod';
import { LANGUAGES } from '../../../config/constants.js';
import { CURRENCIES } from '../../../domain/shared/currencies.js';

export const preferencesSchema = z
  .object({
    language: z.enum(LANGUAGES).optional(),
    currency: z.enum(Object.keys(CURRENCIES)).optional(),
  })
  .refine((value) => value.language || value.currency, 'Nothing to update.');

/** Either browser coordinates (auto-detect) or a manually chosen ISO country code. */
export const locationSchema = z.union([
  z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
  }),
  z.object({ countryCode: z.string().trim().length(2, 'Choose a country.') }),
]);
