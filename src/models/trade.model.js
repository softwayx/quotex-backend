import { ALIVE, defineModel } from './base.js';

export default defineModel(
  'Trade',
  'trades',
  {
    session_id: { type: String, required: true },
    user_id: { type: String, required: true },
    seq: { type: Number, required: true },
    result: { type: String, enum: ['WIN', 'LOSS'], required: true },
    amount: { type: Number, required: true },
    payout_pct: { type: Number, required: true },
    pnl: { type: Number, required: true },
    pair: { type: String, default: null },
    is_otc: { type: Boolean, default: false },
    timeframe: { type: String, default: null },
  },
  [
    [{ session_id: 1, seq: 1 }, { unique: true, partialFilterExpression: ALIVE }],
    [{ user_id: 1, created_at: -1 }],
    [{ created_at: -1 }],
  ],
);
