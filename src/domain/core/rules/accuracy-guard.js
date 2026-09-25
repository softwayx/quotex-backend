export const ACCURACY_STAGE = Object.freeze({ OK: 'OK', WARN: 'WARN', FINAL: 'FINAL', STOP: 'STOP' });

/**
 * Over-trading guard based on accuracy (win rate), independent of profit or loss.
 *
 * Once the session has at least `minTrades` trades and accuracy drops below `floorPct`, the user
 * is warned. From then on every further LOSING trade counts. After `extraLosses` more losses
 * (while accuracy is still below the floor) the session is stopped. If accuracy climbs back to the
 * floor, the warning is cleared and the count starts again. This applies even when the session is
 * still in profit: a falling win rate is the signal, not the balance.
 *
 * `trades` is the session's trades in order. A guard with `minTrades` <= 0 or no floor is off.
 */
export const evaluateAccuracyGuard = ({ trades, floorPct, minTrades, extraLosses }) => {
  const total = trades.length;
  let wins = 0;
  let warned = false;
  let lossesSinceWarning = 0;

  const enabled = floorPct > 0 && minTrades > 0 && extraLosses > 0;
  if (enabled) {
    trades.forEach((trade, index) => {
      if (trade.result === 'WIN') wins += 1;
      const count = index + 1;
      const accuracy = (wins / count) * 100;
      const below = count >= minTrades && accuracy < floorPct;
      if (!below) {
        warned = false;
        lossesSinceWarning = 0;
      } else if (!warned) {
        warned = true;
        lossesSinceWarning = 0;
      } else if (trade.result === 'LOSS') {
        lossesSinceWarning += 1;
      }
    });
  } else {
    wins = trades.filter((trade) => trade.result === 'WIN').length;
  }

  const accuracyPct = total ? (wins / total) * 100 : 0;
  if (!enabled || !warned) {
    return { stage: ACCURACY_STAGE.OK, accuracyPct, trades: total, extraLossesLeft: extraLosses ?? 0, floorPct };
  }

  const extraLossesLeft = Math.max(0, extraLosses - lossesSinceWarning);
  const stage =
    extraLossesLeft <= 0 ? ACCURACY_STAGE.STOP : extraLossesLeft === 1 ? ACCURACY_STAGE.FINAL : ACCURACY_STAGE.WARN;
  return { stage, accuracyPct, trades: total, extraLossesLeft, floorPct };
};
