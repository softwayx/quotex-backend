import { withTransaction } from '../../config/database.js';
import { Blog } from '../../models/index.js';
import ApiError from '../../utils/apiError.js';
import { iso } from '../../utils/dates.js';
import { recordAudit } from '../audit/audit.service.js';
import { BLOG_CATEGORIES, categoryBySlug, categorySlug, readingTimeOf, sanitizeContent, slugify } from './content.js';
import { revalidateBlog } from './revalidate.js';

const PUBLISHED = { status: 'published' };
const NEWEST = { is_featured: -1, published_at: -1 };

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- views (camelCase for the API) ----------

const toCard = (doc) => ({
  id: doc._id,
  slug: doc.slug,
  title: doc.title,
  excerpt: doc.excerpt,
  coverImage: doc.cover_image,
  coverImageAlt: doc.cover_image_alt,
  category: doc.category,
  categorySlug: categorySlug(doc.category),
  tags: doc.tags,
  language: doc.language,
  readingTime: doc.reading_time,
  isFeatured: doc.is_featured,
  authorName: doc.author_name,
  publishedAt: iso(doc.published_at),
  updatedAt: iso(doc.updated_at),
});

const toPost = (doc) => ({
  ...toCard(doc),
  content: doc.content,
  faqs: doc.faqs,
  relatedCalculators: doc.related_calculators,
  metaTitle: doc.meta_title,
  metaDescription: doc.meta_description,
  focusKeyword: doc.focus_keyword,
  canonicalUrl: doc.canonical_url,
  views: doc.views,
});

const toAdmin = (doc) => ({ ...toPost(doc), status: doc.status, previousSlugs: doc.previous_slugs, createdAt: iso(doc.created_at) });

const CARD_FIELDS = '-content -faqs';

// ---------- public (published only) ----------

const listFilter = ({ category, tag, lang, calculator }) => {
  const filter = { ...PUBLISHED };
  if (category) filter.category = categoryBySlug(category)?.name ?? '__none__';
  if (tag) filter.tags = tag;
  if (lang) filter.language = lang;
  if (calculator) filter.related_calculators = calculator;
  return filter;
};

export const listPublished = async ({ page = 1, limit = 12, ...filters }) => {
  const filter = listFilter(filters);
  const [total, docs] = await Promise.all([
    Blog.countDocuments(filter),
    Blog.find(filter, CARD_FIELDS).sort(NEWEST).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { items: docs.map(toCard), page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
};

export const listFeatured = async (limit = 3) =>
  (await Blog.find({ ...PUBLISHED, is_featured: true }, CARD_FIELDS).sort({ published_at: -1 }).limit(limit).lean()).map(toCard);

export const listCategories = async () => {
  const counts = await Blog.aggregate([{ $match: PUBLISHED }, { $group: { _id: '$category', count: { $sum: 1 } } }]);
  const byName = new Map(counts.map((c) => [c._id, c.count]));
  return BLOG_CATEGORIES.map((c) => ({ ...c, count: byName.get(c.name) ?? 0 }));
};

export const listForSitemap = async () =>
  (await Blog.find(PUBLISHED, 'slug updated_at').sort({ published_at: -1 }).lean()).map((doc) => ({ slug: doc.slug, updatedAt: iso(doc.updated_at) }));

/**
 * A published post with up to 3 related posts (same category or shared tags). An old slug answers
 * `{ redirectTo }` so the website can redirect permanently. Drafts and unknown slugs are 404.
 */
export const getPublished = async (slug) => {
  const doc = await Blog.findOne({ ...PUBLISHED, slug }).lean();
  if (!doc) {
    const moved = await Blog.findOne({ ...PUBLISHED, previous_slugs: slug }, 'slug').lean();
    if (moved) return { redirectTo: moved.slug };
    throw ApiError.notFound('Post not found.');
  }
  const related = await Blog.find(
    { ...PUBLISHED, _id: { $ne: doc._id }, $or: [{ category: doc.category }, { tags: { $in: doc.tags } }] },
    CARD_FIELDS,
  )
    .sort({ published_at: -1 })
    .limit(3)
    .lean();
  return { post: toPost(doc), related: related.map(toCard) };
};

/** Counted from the reader's browser (pages are cached, so a server fetch is not a visit). */
export const countView = (slug) => Blog.updateOne({ ...PUBLISHED, slug }, { $inc: { views: 1 } }, { timestamps: false });

// ---------- admin ----------

export const listForAdmin = async ({ q, status, category, page = 1, limit = 20 }) => {
  const filter = {};
  if (q) filter.title = new RegExp(escapeRegex(q), 'i');
  if (status) filter.status = status;
  if (category) filter.category = category;
  const [total, docs] = await Promise.all([
    Blog.countDocuments(filter),
    Blog.find(filter, CARD_FIELDS + ' -previous_slugs').sort({ updated_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return {
    items: docs.map((doc) => ({ ...toCard(doc), status: doc.status, views: doc.views, hasCoverImage: Boolean(doc.cover_image) })),
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
};

export const getForAdmin = async (id) => {
  const doc = await Blog.findById(id).lean();
  if (!doc) throw ApiError.notFound('Post not found.');
  return toAdmin(doc);
};

/** A slug may not be any other post's current or previous slug (old slugs keep redirecting). */
const assertSlugFree = async (slug, exceptId, session) => {
  const clash = await Blog.exists({ _id: { $ne: exceptId }, $or: [{ slug }, { previous_slugs: slug }] }).session(session);
  if (clash) throw ApiError.conflict('SLUG_TAKEN', 'Another post already uses this URL (slug). Choose a different one.');
};

/** Admin input (camelCase) -> stored fields. Content is sanitized and the reading time recalculated. */
const toFields = (input) => {
  const content = sanitizeContent(input.content);
  const slug = slugify(input.slug || input.title);
  if (!slug) throw ApiError.validation('Add a URL slug using English letters or numbers.');
  return {
    title: input.title,
    slug,
    excerpt: input.excerpt,
    content,
    cover_image: input.coverImage || null,
    cover_image_alt: input.coverImageAlt ?? '',
    category: input.category,
    tags: [...new Set(input.tags)],
    language: input.language,
    meta_title: input.metaTitle ?? '',
    meta_description: input.metaDescription ?? '',
    focus_keyword: input.focusKeyword ?? '',
    canonical_url: input.canonicalUrl || null,
    faqs: input.faqs,
    related_calculators: [...new Set(input.relatedCalculators)],
    is_featured: input.isFeatured,
    author_name: input.authorName || 'RiskQuo Team',
    reading_time: readingTimeOf(content),
  };
};

const audit = (admin, action, doc, session, extra = {}) =>
  recordAudit({ adminId: admin.id, action, details: { title: doc.title, slug: doc.slug, ...extra } }, session);

export const createPost = async (admin, input) => {
  const fields = toFields(input);
  const doc = await withTransaction(async (session) => {
    await assertSlugFree(fields.slug, null, session);
    const publish = input.status === 'published';
    const [created] = await Blog.create([{ ...fields, status: publish ? 'published' : 'draft', published_at: publish ? new Date() : null }], { session });
    await audit(admin, 'BLOG_CREATED', created, session, { status: created.status });
    return created.toObject();
  });
  if (doc.status === 'published') await revalidateBlog({ slug: doc.slug, category: categorySlug(doc.category) });
  return toAdmin(doc);
};

export const updatePost = async (admin, id, input) => {
  const fields = toFields(input);
  const { before, after } = await withTransaction(async (session) => {
    const existing = await Blog.findById(id, null, { session }).lean();
    if (!existing) throw ApiError.notFound('Post not found.');
    await assertSlugFree(fields.slug, id, session);
    // After a post has been public, a changed slug keeps the old one for redirects.
    const previous = new Set(existing.previous_slugs);
    if (fields.slug !== existing.slug && existing.published_at) previous.add(existing.slug);
    previous.delete(fields.slug);
    const updated = await Blog.findOneAndUpdate(
      { _id: id },
      { $set: { ...fields, previous_slugs: [...previous] } },
      { returnDocument: 'after', session, lean: true },
    );
    await audit(admin, 'BLOG_UPDATED', updated, session);
    return { before: existing, after: updated };
  });
  if (before.status === 'published' || after.status === 'published') {
    await revalidateBlog({ slug: after.slug, previousSlugs: after.previous_slugs, category: categorySlug(after.category) });
    if (before.category !== after.category) await revalidateBlog({ slug: after.slug, category: categorySlug(before.category) });
  }
  return toAdmin(after);
};

/** Publish or unpublish. `published_at` is set on the first publish only. */
export const setPostStatus = async (admin, id, status) => {
  const doc = await withTransaction(async (session) => {
    const existing = await Blog.findById(id, null, { session }).lean();
    if (!existing) throw ApiError.notFound('Post not found.');
    const set = { status };
    if (status === 'published' && !existing.published_at) set.published_at = new Date();
    const updated = await Blog.findOneAndUpdate({ _id: id }, { $set: set }, { returnDocument: 'after', session, lean: true });
    await audit(admin, status === 'published' ? 'BLOG_PUBLISHED' : 'BLOG_UNPUBLISHED', updated, session);
    return updated;
  });
  await revalidateBlog({ slug: doc.slug, previousSlugs: doc.previous_slugs, category: categorySlug(doc.category) });
  return toAdmin(doc);
};

export const deletePost = async (admin, id) => {
  const doc = await withTransaction(async (session) => {
    const existing = await Blog.findById(id, null, { session }).lean();
    if (!existing) throw ApiError.notFound('Post not found.');
    await Blog.softDelete({ _id: id }, { session });
    await audit(admin, 'BLOG_DELETED', existing, session);
    return existing;
  });
  if (doc.status === 'published') await revalidateBlog({ slug: doc.slug, previousSlugs: doc.previous_slugs, category: categorySlug(doc.category) });
  return { deleted: true };
};

/** Seeder: insert or refresh a post by slug without touching views or a cover image added later. */
export const upsertSeedPost = async (input) => {
  const fields = toFields(input);
  const { cover_image: _cover, cover_image_alt: _alt, ...rest } = fields;
  const existing = await Blog.findOne({ slug: fields.slug }).lean();
  if (existing) {
    await Blog.updateOne({ _id: existing._id }, { $set: { ...rest, status: 'published', published_at: existing.published_at ?? new Date(input.publishedAt) } });
    return { slug: fields.slug, created: false };
  }
  await Blog.create([{ ...fields, status: 'published', published_at: new Date(input.publishedAt) }]);
  return { slug: fields.slug, created: true };
};
