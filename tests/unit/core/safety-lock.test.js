import { describe, expect, it } from '@jest/globals';
import { safetyLockUntil } from '../../../src/domain/core/rules/safety-lock.js';

// 2026-09-21 in IST: 11:00 PM = 17:30 UTC, 10:00 AM = 04:30 UTC
describe('safetyLockUntil', () => {
  it('opens at midnight IST when min hours still land on the same day', () => {
    expect(safetyLockUntil('2026-09-21T04:30:00Z', 6).toISOString()).toBe('2026-09-21T18:30:00.000Z');
  });
  it('waits the full minimum when it crosses midnight (11 PM -> 5 AM)', () => {
    expect(safetyLockUntil('2026-09-21T17:30:00Z', 6).toISOString()).toBe('2026-09-21T23:30:00.000Z');
  });
  it('uses the admin minimum', () => {
    expect(safetyLockUntil('2026-09-21T17:30:00Z', 2).toISOString()).toBe('2026-09-21T19:30:00.000Z');
  });
});
