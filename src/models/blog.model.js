import { ALIVE, defineModel } from './base.js';

/** Blog posts written by the super admin. `content` is sanitized HTML. */
export default defineModel(
  'Blog',
  'blogs',
  {
    title: { type: String, required: true },
    slug: { type: String, required: true },
    /** Slugs this post had after it was first published; the website 301-redirects them. */
    previous_slugs: { type: [String], default: [] },
    excerpt: { type: String, default: '' },
    content: { type: String, default: '' },
    cover_image: { type: String, default: null },
    cover_image_alt: { type: String, default: '' },
    category: { type: String, required: true },
    tags: { type: [String], default: [] },
    language: { type: String, enum: ['en', 'hi'], default: 'en' },
    meta_title: { type: String, default: '' },
    meta_description: { type: String, default: '' },
    focus_keyword: { type: String, default: '' },
    canonical_url: { type: String, default: null },
    faqs: { type: [{ _id: false, question: String, answer: String }], default: [] },
    related_calculators: { type: [String], default: [] },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    is_featured: { type: Boolean, default: false },
    published_at: { type: Date, default: null },
    author_name: { type: String, default: 'RiskQuo Team' },
    reading_time: { type: Number, default: 1 },
    views: { type: Number, default: 0 },
  },
  [
    [{ slug: 1 }, { unique: true, partialFilterExpression: ALIVE }],
    [{ previous_slugs: 1 }],
    [{ status: 1, published_at: -1 }],
    [{ category: 1 }],
    [{ tags: 1 }],
  ],
);
