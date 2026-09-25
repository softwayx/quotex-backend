import { defineModel } from './base.js';

/** Risk rule fields shared by recommended settings, user overrides and session snapshots. */
export const RULE_FIELDS = [
  'daily_loss_limit_pct',
  'consecutive_loss_limit',
  'first_trade_pct',
  'recovery_extra_pct',
  'profit_reinvest_pct',
  'max_trade_pct',
  'accuracy_floor_pct',
  'accuracy_min_trades',
  'accuracy_extra_losses',
  'profit_protect_start_pct',
  'profit_giveback_pct',
  'profit_loss_streak',
  'profit_warn_points',
  'profit_stop_points',
  'profit_peak_trades',
  'profit_peak_minutes',
  'profit_extra_losses',
];

/** Single document (`_id: 'default'`) edited by the super admin. */
export default defineModel('RecommendedSettings', 'recommended_settings', {
  ...Object.fromEntries(RULE_FIELDS.map((field) => [field, { type: Number, required: true }])),
  updated_by: { type: String, default: null },
});
