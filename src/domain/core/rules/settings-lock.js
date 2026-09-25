import { LOCK_PERIODS, PROTECTED_SETTING_KEYS } from '../constants.js';

export const lockPeriodEnd = (periodKey, from = new Date()) => {
  const period = LOCK_PERIODS[periodKey];
  if (!period) throw new Error(`Invalid lock period: ${periodKey}`);
  return new Date(new Date(from).getTime() + period.days * 86_400_000);
};

export const isProtectedLockActive = (lockedUntil, now = new Date()) =>
  Boolean(lockedUntil) && new Date(lockedUntil).getTime() > now.getTime();

export const touchesProtectedSettings = (changedKeys) =>
  changedKeys.some((key) => PROTECTED_SETTING_KEYS.includes(key));

/** Protected settings cannot be edited, reset or disabled while the lock is active. */
export const canChangeSettings = ({ changedKeys, lockedUntil, now = new Date() }) =>
  !(touchesProtectedSettings(changedKeys) && isProtectedLockActive(lockedUntil, now));
