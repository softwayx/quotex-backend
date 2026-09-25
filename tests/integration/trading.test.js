import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { DailyStat, Trade } from '../../src/models/index.js';
import { createUser, userCookie } from '../helpers/factories.js';
import { api, closeDb, resetDb, setupDb } from '../helpers/testApp.js';

beforeAll(setupDb);
beforeEach(resetDb);
afterAll(closeDb);

const as = (cookie) => ({
  get: (path) => api().get(`/api/v1/user${path}`).set('Cookie', cookie),
  post: (path, body = {}) => api().post(`/api/v1/user${path}`).set('Cookie', cookie).send(body),
  patch: (path, body) => api().patch(`/api/v1/user${path}`).set('Cookie', cookie).send(body),
  put: (path, body) => api().put(`/api/v1/user${path}`).set('Cookie', cookie).send(body),
});

const startDay = (client) => client.post('/session/start', { startingCapital: 10000, target: 500, minPayoutPct: 80 });

describe('trading session (same rules as the old app)', () => {
  it('setup -> loss -> recovery ₹275 -> loss limit lock -> no more trades or sessions', async () => {
    const client = as(await userCookie(await createUser()));

    const setup = await client.get('/session');
    expect(setup.body.data.phase).toBe('SETUP');

    const started = await startDay(client);
    expect(started.status).toBe(201);
    expect(started.body.data.phase).toBe('ACTIVE');
    expect(started.body.data.recommendation.amount).toBe(200); // 2% of 10,000

    expect((await startDay(client)).body.error.code).toBe('SESSION_ALREADY_ACTIVE');

    const loss = await client.post('/session/trade', { result: 'LOSS', amount: 200 });
    expect(loss.status).toBe(201);
    // Recovery: ceil5(200 × 1.10 / 0.80) = 275
    expect(loss.body.data.recommendation.amount).toBe(275);
    expect(loss.body.data.protection.remaining).toBe(800);

    const tooBig = await client.post('/session/trade', { result: 'LOSS', amount: 900 });
    expect(tooBig.status).toBe(422);
    expect(tooBig.body.error).toEqual(expect.objectContaining({ code: 'AMOUNT_EXCEEDS_PROTECTION', details: { remaining: 800 } }));

    await client.post('/session/trade', { result: 'LOSS', amount: 275 }).expect(201);
    const last = await client.post('/session/trade', { result: 'LOSS', amount: 525 });
    expect(last.body.data.limitJustReached).toBe(true);
    expect(last.body.data.phase).toBe('LIMIT_REACHED');

    const blocked = await client.post('/session/trade', { result: 'WIN', amount: 100 });
    expect(blocked.status).toBe(423);
    expect(blocked.body.error.code).toBe('LIMIT_REACHED');

    const summary = await client.post('/session/finish');
    expect(summary.status).toBe(200);
    expect(summary.body.data.stats.netPnl).toBe(-1000);

    const again = await startDay(client);
    expect(again.status).toBe(423);
    expect(again.body.error.code).toBe('SAFETY_LOCKED');
    expect((await client.get('/session')).body.data.phase).toBe('SAFETY_LOCKED');
  });

  it('win uses the actual payout; history and analytics see the finished day', async () => {
    const client = as(await userCookie(await createUser()));
    await startDay(client);
    const win = await client.post('/session/trade', { result: 'WIN', amount: 200, actualPayoutPct: 90, pair: ' eur/usd ', timeframe: '1m' });
    expect(win.body.data.lastTrade).toEqual(expect.objectContaining({ pnl: 180, payoutPct: 90, pair: 'EUR/USD', timeframe: '1m', seq: 1 }));

    await client.patch('/session/payout', { minPayoutPct: 85 }).expect(200);
    const finished = await client.post('/session/finish');
    const sessionId = finished.body.data.session.id;

    const history = await client.get('/history');
    expect(history.body.data.days).toEqual([expect.objectContaining({ sessionId, netPnl: 180, totalTrades: 1 })]);
    const day = await client.get(`/history/${sessionId}`);
    expect(day.body.data.trades).toHaveLength(1);

    const weekly = await client.get('/analytics/weekly');
    expect(weekly.body.data.trades).toHaveLength(1);
    expect(weekly.body.data.trades[0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await DailyStat.countDocuments()).toBe(1);
  });

  it('protected settings lock; flexible settings reset to the recommendation', async () => {
    const client = as(await userCookie(await createUser()));
    const body = {
      dailyLossLimitPct: 8,
      consecutiveLossLimit: 3,
      accuracyFloorPct: 60,
      accuracyMinTrades: 10,
      accuracyExtraLosses: 2,
      profitProtectStartPct: 70,
      profitGivebackPct: 15,
      profitLossStreak: 3,
      profitWarnPoints: 2,
      profitStopPoints: 3,
      profitPeakTrades: 8,
      profitPeakMinutes: 30,
      profitExtraLosses: 1,
      lockPeriod: 'DAYS_7',
      confirmed: true,
    };
    const committed = await client.put('/settings/protected', body);
    expect(committed.body.data.protectedLocked).toBe(true);
    expect(committed.body.data.settings.dailyLossLimitPct).toBe(8);
    expect((await client.put('/settings/protected', body)).body.error.code).toBe('SETTINGS_LOCKED');

    const own = await client.patch('/settings/flexible', { firstTradePct: 3 });
    expect(own.body.data.settings.firstTradePct).toBe(3);
    const reset = await client.patch('/settings/flexible', { reset: true });
    expect(reset.body.data.settings.firstTradePct).toBe(reset.body.data.recommended.firstTradePct);
  });

  it('paywalls a trial user after 10 analyses', async () => {
    const client = as(await userCookie(await createUser()));
    await startDay(client);
    for (let i = 0; i < 10; i += 1) await client.post('/session/trade', { result: 'WIN', amount: 5 }).expect(201);
    const res = await client.post('/session/trade', { result: 'WIN', amount: 5 });
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('PAYWALL');
    expect(await Trade.countDocuments()).toBe(10);
  });
});
