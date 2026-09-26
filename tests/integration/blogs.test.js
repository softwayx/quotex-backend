import http from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';

// A fake website that records the revalidation calls the API makes.
const REVALIDATE_PORT = 56992;
process.env.SITE_URL = `http://127.0.0.1:${REVALIDATE_PORT}`;
process.env.REVALIDATE_SECRET = 'test-revalidate-secret';

const { Blog } = await import('../../src/models/index.js');
const { adminCookie, createAdmin } = await import('../helpers/factories.js');
const { api, closeDb, resetDb, setupDb } = await import('../helpers/testApp.js');

const revalidations = [];
const website = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    revalidations.push({ url: req.url, body: JSON.parse(body || '{}') });
    res.end('{"revalidated":true}');
  });
});

beforeAll(async () => {
  await setupDb();
  await new Promise((resolve) => website.listen(REVALIDATE_PORT, '127.0.0.1', resolve));
});
beforeEach(async () => {
  await resetDb();
  revalidations.length = 0;
});
afterAll(async () => {
  await new Promise((resolve) => website.close(resolve));
  await closeDb();
});

const post = (overrides = {}) => ({
  title: 'The 1% Risk Rule Explained',
  excerpt: 'How much to risk per trade.',
  content: '<h2>Why</h2><p>Small risk keeps you in the game.</p>',
  category: 'Risk Management',
  tags: ['risk', 'Beginners'],
  language: 'en',
  faqs: [{ question: 'What is it?', answer: 'Risk 1% per trade.' }],
  relatedCalculators: ['/binary-risk-calculator'],
  ...overrides,
});

const asAdmin = async (role) => {
  const cookie = await adminCookie(await createAdmin(role ? { role } : {}));
  return {
    get: (path) => api().get(`/api/v1/admin/blogs${path}`).set('Cookie', cookie),
    post: (path, body) => api().post(`/api/v1/admin/blogs${path}`).set('Cookie', cookie).send(body),
    put: (path, body) => api().put(`/api/v1/admin/blogs${path}`).set('Cookie', cookie).send(body),
    patch: (path, body) => api().patch(`/api/v1/admin/blogs${path}`).set('Cookie', cookie).send(body),
    del: (path) => api().delete(`/api/v1/admin/blogs${path}`).set('Cookie', cookie),
    upload: (buffer, name) => api().post('/api/v1/admin/blogs/upload-image').set('Cookie', cookie).attach('image', buffer, name),
  };
};

describe('blog admin API', () => {
  it('only a super admin gets in', async () => {
    expect((await api().get('/api/v1/admin/blogs')).status).toBe(401);
    const viewer = await asAdmin('VIEWER');
    expect((await viewer.get('')).status).toBe(403);
    expect((await viewer.post('', post())).status).toBe(403);
  });

  it('creates a draft with an auto slug, sanitized content and reading time', async () => {
    const admin = await asAdmin();
    const res = await admin.post('', post({
      content: '<h1>Big</h1><p onclick="x()">Hi <script>alert(1)</script><a href="https://example.com">out</a> <a href="/martingale-calculator">in</a></p>',
    }));
    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(data).toEqual(expect.objectContaining({ slug: 'the-1-risk-rule-explained', status: 'draft', publishedAt: null, readingTime: 1, tags: ['risk', 'beginners'] }));
    expect(data.content).toBe('<h2>Big</h2><p>Hi <a href="https://example.com" target="_blank" rel="noopener noreferrer">out</a> <a href="/martingale-calculator">in</a></p>');
    expect(revalidations).toHaveLength(0); // drafts are not public
  });

  it('rejects a duplicate slug and bad input', async () => {
    const admin = await asAdmin();
    await admin.post('', post()).expect(201);
    const dup = await admin.post('', post({ title: 'Another title', slug: 'the-1-risk-rule-explained' }));
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('SLUG_TAKEN');
    const bad = await admin.post('', post({ metaTitle: 'x'.repeat(61) }));
    expect(bad.status).toBe(422);
    expect(bad.body.error.message).toMatch(/60 characters/);
    expect((await admin.post('', post({ relatedCalculators: ['/not-a-page'] }))).status).toBe(422);
  });

  it('publish sets publishedAt once, revalidates, and only published posts are public', async () => {
    const admin = await asAdmin();
    const { id, slug } = (await admin.post('', post())).body.data;
    expect((await api().get(`/api/v1/public/blogs/${slug}`)).status).toBe(404);

    const published = (await admin.patch(`/${id}/status`, { status: 'published' })).body.data;
    expect(published.publishedAt).not.toBeNull();
    expect(revalidations.at(-1)).toEqual({ url: '/api/revalidate?secret=test-revalidate-secret', body: { slug, previousSlugs: [], category: 'risk-management' } });

    await admin.patch(`/${id}/status`, { status: 'draft' }).expect(200);
    const again = (await admin.patch(`/${id}/status`, { status: 'published' })).body.data;
    expect(again.publishedAt).toBe(published.publishedAt);

    const list = await api().get('/api/v1/public/blogs?category=risk-management');
    expect(list.body.data).toEqual(expect.objectContaining({ total: 1, page: 1 }));
    expect(list.body.data.items[0].content).toBeUndefined();
    const categories = (await api().get('/api/v1/public/blogs/categories')).body.data.items;
    expect(categories.find((c) => c.slug === 'risk-management').count).toBe(1);
    expect((await api().get('/api/v1/public/blogs/sitemap')).body.data.items.map((i) => i.slug)).toEqual([slug]);
  });

  it('a slug changed after publishing redirects from the old slug', async () => {
    const admin = await asAdmin();
    const { id } = (await admin.post('', post({ status: 'published' }))).body.data;
    const updated = (await admin.put(`/${id}`, post({ slug: 'one-percent-rule' }))).body.data;
    expect(updated.previousSlugs).toEqual(['the-1-risk-rule-explained']);

    const old = await api().get('/api/v1/public/blogs/the-1-risk-rule-explained');
    expect(old.body.data).toEqual({ redirectTo: 'one-percent-rule' });
    const current = await api().get('/api/v1/public/blogs/one-percent-rule');
    expect(current.body.data.post.title).toBe('The 1% Risk Rule Explained');
    // The old slug stays reserved for the redirect.
    expect((await admin.post('', post({ title: 'Another post', slug: 'the-1-risk-rule-explained' }))).status).toBe(409);
  });

  it('related posts, views and delete', async () => {
    const admin = await asAdmin();
    const a = (await admin.post('', post({ status: 'published' }))).body.data;
    await admin.post('', post({ title: 'Stop after losses', status: 'published' })).expect(201);
    await admin.post('', post({ title: 'Hindi post', category: 'Hindi', tags: ['hindi'], status: 'published' })).expect(201);

    const detail = (await api().get(`/api/v1/public/blogs/${a.slug}`)).body.data;
    expect(detail.related.map((r) => r.slug)).toEqual(['stop-after-losses']);

    const before = await Blog.findById(a.id).lean();
    await api().post(`/api/v1/public/blogs/${a.slug}/view`).expect(200);
    const after = await Blog.findById(a.id).lean();
    expect(after.views).toBe(1);
    expect(after.updated_at).toEqual(before.updated_at);

    await admin.del(`/${a.id}`).expect(200);
    expect((await api().get(`/api/v1/public/blogs/${a.slug}`)).status).toBe(404);
    expect(await Blog.countDocuments({ _id: a.id }, { withDeleted: true })).toBe(1);
  });

  it('validates image uploads (type by content, 2 MB limit, storage configured)', async () => {
    const admin = await asAdmin();
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);
    expect((await admin.upload(Buffer.from('not an image'), 'fake.png')).body.error.message).toMatch(/JPG, PNG or WebP/);
    expect((await admin.upload(Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]), 'big.png')).body.error.message).toMatch(/2 MB/);
    const noKeys = await admin.upload(png, 'ok.png');
    expect(noKeys.status).toBe(503);
    expect(noKeys.body.error.code).toBe('UPLOAD_UNAVAILABLE');
  });
});
