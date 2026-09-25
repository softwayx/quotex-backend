import { z } from 'zod';

export const lockSettingsSchema = z.object({ lockMinHours: z.coerce.number().int().min(1).max(24) });

export const communityFeatureSchema = z.object({ enabled: z.boolean() });

export const recommendedSettingsSchema = z
  .object({
    dailyLossLimitPct: z.coerce.number().min(1, 'Daily loss limit must be at least 1%.').max(100),
    consecutiveLossLimit: z.coerce.number().int().min(1).max(20),
    firstTradePct: z.coerce.number().min(0.1).max(100),
    recoveryExtraPct: z.coerce.number().min(0).max(100),
    profitReinvestPct: z.coerce.number().min(0).max(100),
    maxTradePct: z.coerce.number().min(1).max(100),
    accuracyFloorPct: z.coerce.number().min(1, 'Accuracy floor must be at least 1%.').max(100),
    accuracyMinTrades: z.coerce.number().int().min(1).max(200),
    accuracyExtraLosses: z.coerce.number().int().min(1).max(20),
    profitProtectStartPct: z.coerce.number().min(1, 'Must be at least 1%.').max(100),
    profitGivebackPct: z.coerce.number().min(1, 'Must be at least 1%.').max(100),
    profitLossStreak: z.coerce.number().int().min(1).max(20),
    profitWarnPoints: z.coerce.number().int().min(1).max(5),
    profitStopPoints: z.coerce.number().int().min(1).max(5),
    profitPeakTrades: z.coerce.number().int().min(1).max(200),
    profitPeakMinutes: z.coerce.number().int().min(1).max(1440),
    profitExtraLosses: z.coerce.number().int().min(1).max(20),
  })
  .refine((v) => v.profitStopPoints >= v.profitWarnPoints, {
    path: ['profitStopPoints'],
    message: 'Lock points cannot be lower than warning points.',
  });
