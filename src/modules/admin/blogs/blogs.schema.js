import { z } from 'zod';
import { BLOG_CATEGORIES, CALCULATOR_PATHS } from '../../../domain/blog/content.js';

export const blogIdParams = z.object({ id: z.uuid('Invalid post id.') });

export const adminListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(['draft', 'published']).optional().catch(undefined),
  category: z.enum(BLOG_CATEGORIES.map((c) => c.name)).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().default(1).catch(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20).catch(20),
});

const optionalUrl = z.union([z.url({ protocol: /^https$/, message: 'Use an https:// link.' }), z.literal(''), z.null()]).optional();

export const blogSchema = z.object({
  title: z.string().trim().min(3, 'Title is too short.').max(120),
  slug: z.string().trim().max(80).optional().default(''),
  excerpt: z.string().trim().max(160, 'Excerpt: at most 160 characters.').default(''),
  content: z.string().max(300_000, 'The post is too long.').default(''),
  coverImage: optionalUrl,
  coverImageAlt: z.string().trim().max(150).optional().default(''),
  category: z.enum(BLOG_CATEGORIES.map((c) => c.name), { message: 'Choose a category.' }),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(12).default([]),
  language: z.enum(['en', 'hi']).default('en'),
  metaTitle: z.string().trim().max(60, 'Meta title: at most 60 characters.').optional().default(''),
  metaDescription: z.string().trim().max(155, 'Meta description: at most 155 characters.').optional().default(''),
  focusKeyword: z.string().trim().max(80).optional().default(''),
  canonicalUrl: optionalUrl,
  faqs: z
    .array(z.object({ question: z.string().trim().min(3).max(200), answer: z.string().trim().min(3).max(1500) }))
    .max(12)
    .default([]),
  relatedCalculators: z.array(z.enum(CALCULATOR_PATHS)).max(6).default([]),
  isFeatured: z.boolean().default(false),
  authorName: z.string().trim().max(60).optional().default(''),
  /** Only used on create: save straight as published. */
  status: z.enum(['draft', 'published']).optional(),
});

export const statusSchema = z.object({ status: z.enum(['draft', 'published']) });
