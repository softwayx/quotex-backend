import { ALIVE, defineModel } from './base.js';

export default defineModel(
  'Referral',
  'referrals',
  {
    referrer_id: { type: String, required: true },
    referee_id: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'REWARDED', 'CAPPED'], default: 'PENDING' },
    referrer_days: { type: Number, default: 0 },
    referee_days: { type: Number, default: 0 },
    rewarded_at: { type: Date, default: null },
  },
  [
    [{ referee_id: 1 }, { unique: true, partialFilterExpression: ALIVE }],
    [{ referrer_id: 1, created_at: -1 }],
  ],
);
