import { describe, expect, it } from '@jest/globals';
import { COMMUNITY_ACCESS_DAYS, communityAccessFor, communityVisibleFor } from '../../../src/domain/core/index.js';

const DAY_MS = 86_400_000;
const now = new Date('2026-09-23T00:00:00Z');
const daysAgo = (days) => new Date(now.getTime() - days * DAY_MS);

describe('communityAccessFor', () => {
  it('is locked on day one, with the full wait still ahead', () => {
    const r = communityAccessFor({ createdAt: daysAgo(0), earlyAccess: false }, now);
    expect(r.unlocked).toBe(false);
    expect(r.daysLeft).toBe(COMMUNITY_ACCESS_DAYS);
  });

  it('counts down as the join date recedes', () => {
    const r = communityAccessFor({ createdAt: daysAgo(30), earlyAccess: false }, now);
    expect(r.unlocked).toBe(false);
    expect(r.daysLeft).toBe(COMMUNITY_ACCESS_DAYS - 30);
  });

  it('unlocks exactly at the threshold and stays unlocked after', () => {
    const atThreshold = communityAccessFor({ createdAt: daysAgo(COMMUNITY_ACCESS_DAYS), earlyAccess: false }, now);
    expect(atThreshold.unlocked).toBe(true);
    expect(atThreshold.daysLeft).toBe(0);

    const wellPast = communityAccessFor({ createdAt: daysAgo(COMMUNITY_ACCESS_DAYS + 200), earlyAccess: false }, now);
    expect(wellPast.unlocked).toBe(true);
    expect(wellPast.daysLeft).toBe(0);
  });

  it('early access overrides the wait regardless of join date', () => {
    const r = communityAccessFor({ createdAt: daysAgo(0), earlyAccess: true }, now);
    expect(r.unlocked).toBe(true);
    expect(r.daysLeft).toBe(0);
  });
});

describe('communityVisibleFor', () => {
  it('is hidden when neither the global switch nor early access is on', () => {
    expect(communityVisibleFor({ globalEnabled: false, earlyAccess: false })).toBe(false);
  });
  it('shows for everyone once the global switch is on', () => {
    expect(communityVisibleFor({ globalEnabled: true, earlyAccess: false })).toBe(true);
  });
  it('shows for a specific user with early access even while the global switch is off', () => {
    expect(communityVisibleFor({ globalEnabled: false, earlyAccess: true })).toBe(true);
  });
});
