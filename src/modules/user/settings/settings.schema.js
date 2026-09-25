import { z } from 'zod';

export const protectedSettingsSchema = z
  .object({
    dailyLossLimitPct: z.coerce.number().min(1, 'Minimum 1%.').max(100),
    consecutiveLossLimit: z.coerce.number().int().min(1).max(20),
    accuracyFloorPct: z.coerce.number().min(1, 'Minimum 1%.').max(100),
    accuracyMinTrades: z.coerce.number().int().min(1).max(200),
    accuracyExtraLosses: z.coerce.number().int().min(1).max(20),
    profitProtectStartPct: z.coerce.number().min(1, 'Minimum 1%.').max(100),
    profitGivebackPct: z.coerce.number().min(1, 'Minimum 1%.').max(100),
    profitLossStreak: z.coerce.number().int().min(1).max(20),
    profitWarnPoints: z.coerce.number().int().min(1).max(5),
    profitStopPoints: z.coerce.number().int().min(1).max(5),
    profitPeakTrades: z.coerce.number().int().min(1).max(200),
    profitPeakMinutes: z.coerce.number().int().min(1).max(1440),
    profitExtraLosses: z.coerce.number().int().min(1).max(20),
    lockPeriod: z.enum(['DAY_1', 'DAYS_7', 'MONTH_1']),
    confirmed: z.literal(true, { message: 'Please confirm the lock.' }),
  })
  .refine((v) => v.profitStopPoints >= v.profitWarnPoints, {
    path: ['profitStopPoints'],
    message: 'Lock points cannot be lower than warning points.',
  });

export const flexibleSettingsSchema = z
  .object({
    firstTradePct: z.coerce.number().min(0.1).max(100).optional(),
    recoveryExtraPct: z.coerce.number().min(0).max(100).optional(),
    profitReinvestPct: z.coerce.number().min(0).max(100).optional(),
    maxTradePct: z.coerce.number().min(1).max(100).optional(),
    reset: z.boolean().optional(),
  })
  .refine(
    (v) => v.reset || v.firstTradePct !== undefined || v.recoveryExtraPct !== undefined || v.profitReinvestPct !== undefined || v.maxTradePct !== undefined,
    'Nothing to update.',
  );
