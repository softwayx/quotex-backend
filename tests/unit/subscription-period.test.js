import { describe, expect, it } from '@jest/globals';
import { planPeriod } from '../../src/domain/subscriptions/subscriptions.js';

const now = new Date('2026-09-20T12:00:00Z');
const inDays = (n) => new Date(now.getTime() + n * 86_400_000);

describe('plan period after a payment', () => {
  it('starts now when the user has no plan', () => {
    const p = planPeriod({ currentExpiry: null, onTrial: false, durationDays: 30, now });
    expect(p.extend).toBe(false);
    expect(p.expiresAt).toEqual(inDays(30));
  });
  it('starts now when the old plan already ended', () => {
    const p = planPeriod({ currentExpiry: inDays(-3), onTrial: false, durationDays: 30, now });
    expect(p.startsAt).toEqual(now);
    expect(p.expiresAt).toEqual(inDays(30));
  });
  it('adds the new days after a paid plan that is still running', () => {
    const p = planPeriod({ currentExpiry: inDays(10), onTrial: false, durationDays: 30, now });
    expect(p.extend).toBe(true);
    expect(p.startsAt).toEqual(inDays(10));
    expect(p.expiresAt).toEqual(inDays(40));
  });
  it('an upgrade to Pro starts now and keeps the days left on Basic', () => {
    const p = planPeriod({ currentExpiry: inDays(10), onTrial: false, currentTier: 'BASIC', newTier: 'PRO', durationDays: 30, now });
    expect(p.extend).toBe(false);
    expect(p.startsAt).toEqual(now);
    expect(p.expiresAt).toEqual(inDays(40));
  });
  it('buying Basic while Pro is running adds it after Pro', () => {
    const p = planPeriod({ currentExpiry: inDays(10), onTrial: false, currentTier: 'PRO', newTier: 'BASIC', durationDays: 30, now });
    expect(p.extend).toBe(true);
    expect(p.expiresAt).toEqual(inDays(40));
  });
  it('replaces a running trial but keeps its unused days', () => {
    const p = planPeriod({ currentExpiry: inDays(5), onTrial: true, durationDays: 30, now });
    expect(p.extend).toBe(false);
    expect(p.startsAt).toEqual(now);
    expect(p.expiresAt).toEqual(inDays(35));
  });
});
