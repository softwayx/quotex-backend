import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { api, closeDb, setupDb } from '../helpers/testApp.js';

beforeAll(setupDb);
afterAll(closeDb);

describe('public + envelope', () => {
  it('reports database status', async () => {
    const res = await api().get('/api/v1/public/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: expect.objectContaining({ status: 'ok', database: 'up' }) });
  });

  it('answers unknown routes and bad JSON with the error envelope', async () => {
    const missing = await api().get('/api/v1/nope');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ ok: false, error: expect.objectContaining({ code: 'NOT_FOUND' }) });

    const bad = await api().post('/api/v1/user/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('BAD_JSON');
  });

  it('validation errors carry the first message, like the old API', async () => {
    const res = await api().post('/api/v1/user/auth/register/start').send({ displayName: 'A', username: 'ab' });
    expect(res.status).toBe(422);
    expect(res.body.error).toEqual(expect.objectContaining({ code: 'VALIDATION', message: 'Name is too short.' }));
  });
});
