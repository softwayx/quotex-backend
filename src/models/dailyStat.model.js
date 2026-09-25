import { ALIVE, defineModel } from './base.js';

/** Compact per-session summary written on close/limit. `stat_date` is the IST date (YYYY-MM-DD). */
export default defineModel(
  'DailyStat',
  'daily_stats',
  {
    session_id: { type: String, required: true },
    user_id: { type: String, required: true },
    stat_date: { type: String, required: true },
    starting_capital: Number,
    closing_capital: Number,
    target: Number,
    total_trades: Number,
    wins: Number,
    losses: Number,
    total_profit: Number,
    total_loss: Number,
    net_pnl: Number,
    max_drawdown: Number,
    longest_win_streak: Number,
    longest_loss_streak: Number,
    target_achieved_pct: Number,
    limit_reached: { type: Boolean, default: false },
  },
  [
    [{ session_id: 1 }, { unique: true, partialFilterExpression: ALIVE }],
    [{ user_id: 1, stat_date: -1 }],
  ],
);
