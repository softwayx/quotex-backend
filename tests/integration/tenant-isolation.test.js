import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { adminCookie, createAdmin, createUser, userCookie } from '../helpers/factories.js';
import { api, closeDb, resetDb, setupDb } from '../helpers/testApp.js';

beforeAll(setupDb);
beforeEach(resetDb);
afterAll(closeDb);

const finishedDay = async (cookie) => {
  await api().post('/api/v1/user/session/start').set('Cookie', cookie).send({ startingCapital: 5000, target: 250, minPayoutPct: 80 }).expect(201);
  await api().post('/api/v1/user/session/trade').set('Cookie', cookie).send({ result: 'WIN', amount: 100 }).expect(201);
  return (await api().post('/api/v1/user/session/finish').set('Cookie', cookie)).body.data.session.id;
};

describe('user data isolation', () => {
  it("a user never sees another user's sessions or history", async () => {
    const alice = await userCookie(await createUser());
    const bob = await userCookie(await createUser());
    const aliceDay = await finishedDay(alice);

    expect((await api().get('/api/v1/user/history').set('Cookie', bob)).body.data.days).toEqual([]);
    expect((await api().get(`/api/v1/user/history/${aliceDay}`).set('Cookie', bob)).status).toBe(404);
    expect((await api().get(`/api/v1/user/history/${aliceDay}`).set('Cookie', alice)).status).toBe(200);
    expect((await api().get('/api/v1/user/session').set('Cookie', bob)).body.data.phase).toBe('SETUP');
    expect((await api().get('/api/v1/user/analytics/weekly').set('Cookie', bob)).body.data.trades).toEqual([]);
  });

  it('cookies are bound to their audience', async () => {
    const admin = await adminCookie(await createAdmin());
    const user = await userCookie(await createUser());
    expect((await api().get('/api/v1/user/session').set('Cookie', admin)).status).toBe(401);
    expect((await api().get('/api/v1/admin/overview').set('Cookie', user)).status).toBe(401);
    expect((await api().get('/api/v1/user/session')).status).toBe(401);
  });
});
