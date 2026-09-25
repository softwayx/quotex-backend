import { AMOUNT_ROUNDING_STEP } from '../constants.js';
import { percentOf, roundDownToStep, roundToStep, roundUpToStep } from './money.js';
import { profitFor } from './payout.js';

/** Base trade amount as a fixed % of capital, rounded to a practical step. */
export const baseTradeAmount = (capital, firstTradePct) =>
  Math.max(AMOUNT_ROUNDING_STEP, roundToStep((capital * firstTradePct) / 100, AMOUNT_ROUNDING_STEP));

/** Amount that recovers `outstandingLoss` plus `extraPct` extra when it wins. */
export const recoveryTradeAmount = ({ outstandingLoss, extraPct, payoutPct }) => {
  const objective = outstandingLoss * (1 + extraPct / 100);
  return roundUpToStep(objective / (payoutPct / 100), AMOUNT_ROUNDING_STEP);
};

export const RECOMMENDATION_MODE = Object.freeze({
  BASE: 'BASE',
  RECOVERY: 'RECOVERY',
  RECOVERY_CAPPED: 'RECOVERY_CAPPED',
  CAUTIOUS: 'CAUTIOUS',
  WIN_REINVEST: 'WIN_REINVEST',
  WIN_REINVEST_CAPPED: 'WIN_REINVEST_CAPPED',
  CAPITAL_LIMITED: 'CAPITAL_LIMITED',
  PROTECTION_LIMITED: 'PROTECTION_LIMITED',
  PROFIT_FLOOR_LIMITED: 'PROFIT_FLOOR_LIMITED',
  TARGET_NEAR: 'TARGET_NEAR',
});

/** Smallest amount whose win at `payoutPct` covers `remaining` profit. */
export const amountToReachTarget = (remaining, payoutPct) =>
  roundUpToStep(remaining / (payoutPct / 100), AMOUNT_ROUNDING_STEP);

/**
 * Next trade recommendation.
 * - No outstanding loss            -> base amount
 * - Outstanding loss, under cap    -> recovery amount
 * - Consecutive-loss cap reached   -> base amount (no more escalation)
 * - Profit Protection or Accuracy Guard is warning (`cautious`) -> base amount, no recovery escalation
 *                                      and no reinvest growth, until the warning clears
 * - No loss owed, session in profit -> base + reinvest% of that profit (rest is kept aside),
 *                                      capped at maxTradePct% of current capital
 * If the target is nearly reached, it recommends only what a win needs to reach it.
 * Never recommends less than `minAmount`, nor more than current capital or the remaining daily loss protection,
 * so a single trade can never take the session past its loss limit. Once Profit Protection has ever
 * armed this session, also never more than `profitFloorCap`, so a loss can never erase profit already made.
 */
export const recommendNextTrade = ({
  capital,
  baseAmount,
  outstandingLoss,
  consecutiveLosses,
  payoutPct,
  settings,
  protectionRemaining = Infinity,
  profitFloorCap = Infinity,
  sessionProfit = 0,
  targetRemaining = Infinity,
  minAmount = 0,
  cautious = false,
}) => {
  let mode = RECOMMENDATION_MODE.BASE;
  let amount = baseAmount;

  if (outstandingLoss > 0 && consecutiveLosses >= settings.consecutiveLossLimit) {
    mode = RECOMMENDATION_MODE.RECOVERY_CAPPED;
  } else if (outstandingLoss > 0 && cautious) {
    mode = RECOMMENDATION_MODE.CAUTIOUS;
  } else if (outstandingLoss > 0) {
    mode = RECOMMENDATION_MODE.RECOVERY;
    amount = recoveryTradeAmount({
      outstandingLoss,
      extraPct: settings.recoveryExtraPct,
      payoutPct,
    });
  }

  const reinvestPct = settings.profitReinvestPct ?? 0;
  if (mode === RECOMMENDATION_MODE.BASE && outstandingLoss <= 0 && sessionProfit > 0 && reinvestPct > 0 && !cautious) {
    const boosted = roundToStep(baseAmount + (sessionProfit * reinvestPct) / 100, AMOUNT_ROUNDING_STEP);
    const ceiling = Math.max(
      baseAmount,
      roundDownToStep((capital * (settings.maxTradePct ?? 100)) / 100, AMOUNT_ROUNDING_STEP),
    );
    amount = Math.min(boosted, ceiling);
    if (amount > baseAmount) {
      mode = boosted > ceiling ? RECOMMENDATION_MODE.WIN_REINVEST_CAPPED : RECOMMENDATION_MODE.WIN_REINVEST;
    }
  }

  // Close to the target: a bigger trade adds risk without helping, so only ask for what is needed.
  if (targetRemaining > 0 && Number.isFinite(targetRemaining)) {
    const needed = amountToReachTarget(targetRemaining, payoutPct);
    if (needed < amount) {
      amount = needed;
      mode = RECOMMENDATION_MODE.TARGET_NEAR;
    }
  }

  // Never suggest a trade smaller than the smallest practical amount (about 1 unit of the user's currency).
  if (amount < minAmount) amount = minAmount;

  if (amount > capital) {
    amount = Math.floor(capital);
    mode = RECOMMENDATION_MODE.CAPITAL_LIMITED;
  }

  if (amount > protectionRemaining) {
    // Capped to what's actually left, even if that is below `minAmount` — recommending more than the
    // remaining protection would recommend a trade the server refuses to place. The caller is expected
    // to treat "capped below minAmount" as no real trade being possible (see evaluateProtection).
    amount = Math.floor(protectionRemaining);
    mode = RECOMMENDATION_MODE.PROTECTION_LIMITED;
  }

  // Once the session has ever earned real profit (Profit Protection "armed"), a trade can never be
  // large enough that losing it would erase that profit — same reasoning as the protection cap above.
  if (amount > profitFloorCap) {
    amount = Math.max(0, Math.floor(profitFloorCap));
    mode = RECOMMENDATION_MODE.PROFIT_FLOOR_LIMITED;
  }

  return {
    amount,
    mode,
    expectedProfit: profitFor(amount, payoutPct),
    riskPct: percentOf(amount, capital),
  };
};
