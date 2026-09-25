import { ALIVE, defineModel } from './base.js';
import { RULE_FIELDS } from './recommendedSettings.model.js';

// Risk rules are snapshotted so later setting changes never rewrite history.
const snapshot = Object.fromEntries(
  RULE_FIELDS.filter((field) => field !== 'first_trade_pct').map((field) => [field, { type: Number, default: null }]),
);

export default defineModel(
  'TradingSession',
  'trading_sessions',
  {
    user_id: { type: String, required: true },
    starting_capital: { type: Number, required: true },
    target: { type: Number, required: true },
    min_payout_pct: { type: Number, required: true },
    base_amount: { type: Number, required: true },
    ...snapshot,
    daily_loss_limit_amount: { type: Number, required: true },
    status: { type: String, enum: ['ACTIVE', 'CLOSED', 'LIMIT_REACHED', 'TARGET_REACHED'], default: 'ACTIVE' },
    safety_locked_until: { type: Date, default: null },
    lock_reason: { type: String, default: null },
    last_milestone_pct: { type: Number, default: 0 },
    started_at: { type: Date, default: () => new Date() },
    closed_at: { type: Date, default: null },
  },
  [
    [{ user_id: 1, started_at: -1 }],
    // At most one open session per user.
    [{ user_id: 1 }, { unique: true, name: 'one_active_session', partialFilterExpression: { ...ALIVE, status: 'ACTIVE' } }],
  ],
);
