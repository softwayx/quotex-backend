import { describe, expect, it } from '@jest/globals';
import { freeAnalysesView } from '../../src/domain/entitlements/entitlements.js';

const now = new Date('2026-09-20T12:00:00Z');
const inDays = (n) => new Date(now.getTime() + n * 86_400_000).toISOString();

describe('access rules', () => {
  it('active trial with allowance left is not paywalled', () => {
    const v = freeAnalysesView({ analysesUsed: 3, subscriptionExpiresAt: inDays(5), onTrial: true }, now);
    expect(v.paywalled).toBe(false);
    expect(v.remaining).toBe(7);
  });

  it('trial paywalls when the 10 analyses are used', () => {
    const v = freeAnalysesView({ analysesUsed: 10, subscriptionExpiresAt: inDays(5), onTrial: true }, now);
    expect(v.paywalled).toBe(true);
  });

  it('trial paywalls once its period ends, even with analyses left', () => {
    const v = freeAnalysesView({ analysesUsed: 2, subscriptionExpiresAt: inDays(-1), onTrial: true }, now);
    expect(v.trialExpired).toBe(true);
    expect(v.paywalled).toBe(true);
  });

  it('an active paid plan is unlimited', () => {
    const v = freeAnalysesView({ analysesUsed: 50, subscriptionExpiresAt: inDays(30), onTrial: false }, now);
    expect(v.subscribed).toBe(true);
    expect(v.paywalled).toBe(false);
  });

  it('a lapsed paid plan with the allowance used is paywalled', () => {
    const v = freeAnalysesView({ analysesUsed: 10, subscriptionExpiresAt: inDays(-3), onTrial: false }, now);
    expect(v.subscribed).toBe(false);
    expect(v.paywalled).toBe(true);
  });

  it('a trial plan never counts as a paid subscription', () => {
    const v = freeAnalysesView({ analysesUsed: 10, subscriptionExpiresAt: inDays(5), onTrial: true }, now);
    expect(v.subscribed).toBe(false);
  });
});
