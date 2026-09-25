import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { AuditLog, Plan, User } from '../../src/models/index.js';
import { PASSWORD, adminCookie, createAdmin, createUser, userCookie } from '../helpers/factories.js';
import { api, closeDb, resetDb, setupDb } from '../helpers/testApp.js';

beforeAll(setupDb);
beforeEach(resetDb);
afterAll(closeDb);

const as = (cookie) => ({
  get: (path) => api().get(`/api/v1/admin${path}`).set('Cookie', cookie),
  post: (path, body = {}) => api().post(`/api/v1/admin${path}`).set('Cookie', cookie).send(body),
  patch: (path, body) => api().patch(`/api/v1/admin${path}`).set('Cookie', cookie).send(body),
  put: (path, body) => api().put(`/api/v1/admin${path}`).set('Cookie', cookie).send(body),
  delete: (path) => api().delete(`/api/v1/admin${path}`).set('Cookie', cookie),
});

describe('admin panel API', () => {
  it('logs in with the sa_session cookie', async () => {
    const admin = await createAdmin();
    const res = await api().post('/api/v1/admin/auth/login').send({ username: admin.username, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.admin).toEqual({ id: admin.id, username: admin.username });
    expect(res.headers['set-cookie'].join(';')).toMatch(/sa_session=.+HttpOnly/);
  });

  it('lists and searches users with plan state', async () => {
    const client = as(await adminCookie(await createAdmin()));
    await createUser({ displayName: 'Ravi Kumar' });
    await createUser({ displayName: 'Meena' });

    const all = await client.get('/users');
    expect(all.body.data).toEqual(expect.objectContaining({ total: 2, page: 1, pageSize: 20 }));
    expect(all.body.data.rows[0]).toEqual(expect.objectContaining({ plan_state: 'ACTIVE', plan_name: 'Free Trial', analyses_used: 0, sessions: 0 }));

    const found = await client.get('/users?q=ravi');
    expect(found.body.data.rows.map((u) => u.display_name)).toEqual(['Ravi Kumar']);

    const overview = await client.get('/overview');
    expect(overview.body.data.counts).toEqual(expect.objectContaining({ users: 2, active_plans: 2, expiring: 2 }));
  });

  it('assigns a plan, adjusts, revokes — each audited', async () => {
    const admin = await createAdmin();
    const client = as(await adminCookie(admin));
    const user = await createUser();
    const basic = await Plan.findOne({ tier: 'BASIC' }).lean();

    const assigned = await client.post(`/users/${user.id}/assign-plan`, { planId: basic._id, mode: 'REPLACE' });
    expect(assigned.status).toBe(200);
    await client.post(`/users/${user.id}/adjust-expiry`, { days: 5 }).expect(200);
    await client.post(`/users/${user.id}/revoke-plan`).expect(200);

    const detail = await client.get(`/users/${user.id}`);
    expect(detail.body.data.user.plan_state).toBe('EXPIRED');
    expect(detail.body.data.audit.map((a) => a.action)).toEqual(['PLAN_REVOKED', 'EXPIRY_ADJUSTED', 'PLAN_ASSIGNED']);
    expect(detail.body.data.audit[0].admin_username).toBe(admin.username);
  });

  it('disabling a user signs them out everywhere', async () => {
    const client = as(await adminCookie(await createAdmin()));
    const user = await createUser();
    const cookie = await userCookie(user);
    await client.post(`/users/${user.id}/status`, { status: 'SUSPENDED' }).expect(200);
    expect((await api().get('/api/v1/user/account/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('deleting a user is a soft delete and frees the username', async () => {
    const client = as(await adminCookie(await createAdmin()));
    const user = await createUser({ username: 'reuse_me' });
    await client.delete(`/users/${user.id}`).expect(200);

    expect(await User.countDocuments({ username: 'reuse_me' })).toBe(0);
    const kept = await User.findOne({ username: 'reuse_me' }, null, { withDeleted: true }).lean();
    expect(kept.deletedAt).toBeInstanceOf(Date);
    await createUser({ username: 'reuse_me' });
    expect(await AuditLog.countDocuments({ action: 'USER_DELETED' })).toBe(1);
  });

  it('edits Basic prices, rejects a sale with a missing price', async () => {
    const client = as(await adminCookie(await createAdmin()));
    const basic = await Plan.findOne({ tier: 'BASIC' }).lean();
    const edited = await client.patch(`/plans/${basic._id}`, { priceInr: 149, durationDays: 60 });
    expect(edited.body.data).toEqual(expect.objectContaining({ duration_days: 60, price: 149, prices: [{ currency: 'INR', amount: 149 }, { currency: 'USD', amount: 2 }] }));
    const bad = await client.patch(`/plans/${basic._id}`, { priceUsd: 0 });
    expect(bad.status).toBe(422);
  });

  it('only admins with the permission get in (RBAC)', async () => {
    const client = as(await adminCookie(await createAdmin({ role: 'VIEWER' })));
    expect((await client.get('/users')).status).toBe(403);
  });

  it('recommended settings change is audited and reaches users without their own value', async () => {
    const client = as(await adminCookie(await createAdmin()));
    const current = (await client.get('/recommended-settings')).body.data;
    const { updatedAt: _updatedAt, ...values } = current;
    await client.put('/recommended-settings', { ...values, firstTradePct: 4 }).expect(200);

    const user = await userCookie(await createUser());
    const settings = await api().get('/api/v1/user/settings').set('Cookie', user);
    expect(settings.body.data.settings.firstTradePct).toBe(4);
    expect(await AuditLog.countDocuments({ action: 'RECOMMENDED_UPDATED' })).toBe(1);
  });
});
