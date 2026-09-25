import { z } from 'zod';
import { TIMEFRAMES, normalizePair } from '../../../domain/shared/trade-details.js';

const money = (label) => z.coerce.number({ message: `${label} must be a number.` }).positive(`${label} must be greater than 0.`).max(1e9);

export const startSessionSchema = z.object({
  startingCapital: money('Capital'),
  target: money('Target'),
  minPayoutPct: z.coerce.number().min(1, 'Payout must be at least 1%.').max(200, 'Payout looks too high.'),
  firstTradeAmount: money('Trade amount').optional(),
});

export const changePayoutSchema = z.object({
  minPayoutPct: z.coerce.number().min(1, 'Payout must be at least 1%.').max(200, 'Payout looks too high.'),
});

export const recordTradeSchema = z.object({
  result: z.enum(['WIN', 'LOSS']),
  amount: money('Trade amount'),
  actualPayoutPct: z.coerce.number().min(1).max(200).optional(),
  // Optional details about the trade (used by the Pro insights).
  pair: z
    .string()
    .nullish()
    .transform((value) => normalizePair(value)),
  isOtc: z.boolean().optional().default(false),
  timeframe: z.enum(TIMEFRAMES).nullish(),
});

/** `{ lock: true }` = stop for the day at a target milestone and lock the next hours. */
export const finishSchema = z.object({ lock: z.boolean().optional() });
