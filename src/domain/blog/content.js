import sanitizeHtml from 'sanitize-html';
import env from '../../config/env.js';

/** Fixed categories so URLs (/blog/category/<slug>) stay stable. */
export const BLOG_CATEGORIES = Object.freeze([
  { name: 'Risk Management', slug: 'risk-management' },
  { name: 'Strategies', slug: 'strategies' },
  { name: 'Beginner Guides', slug: 'beginner-guides' },
  { name: 'Hindi', slug: 'hindi' },
]);

export const categoryBySlug = (slug) => BLOG_CATEGORIES.find((c) => c.slug === slug) ?? null;
export const categorySlug = (name) => BLOG_CATEGORIES.find((c) => c.name === name)?.slug ?? null;

/** Public calculator pages a post can link to. */
export const CALCULATOR_PATHS = Object.freeze([
  '/binary-risk-calculator',
  '/quotex-risk-calculator',
  '/martingale-calculator',
  '/compounding-calculator',
  '/money-management-plan',
  '/position-size-calculator',
]);

/** "The 1% Risk Rule!" -> "the-1-risk-rule". Empty for titles without Latin letters/digits. */
export const slugify = (text) =>
  String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');

const siteHost = () => {
  try {
    return new URL(env.SITE_URL).host;
  } catch {
    return '';
  }
};

const isExternal = (href) => /^https?:\/\//i.test(href) && !href.includes(`//${siteHost()}`);

/**
 * Keeps only the formatting the editor produces. Scripts, styles, event handlers and unknown tags are
 * removed. `<h1>` becomes `<h2>` (the page already has the H1). External links get rel="noopener".
 */
export const sanitizeContent = (html) =>
  sanitizeHtml(String(html ?? ''), {
    allowedTags: [
      'h2', 'h3', 'h4', 'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
      'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'blockquote', 'code', 'pre',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
      col: ['span'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    transformTags: {
      h1: 'h2',
      a: (tagName, attribs) => {
        const external = isExternal(attribs.href ?? '');
        return {
          tagName,
          attribs: external ? { ...attribs, target: '_blank', rel: 'noopener noreferrer' } : { href: attribs.href, ...(attribs.title && { title: attribs.title }) },
        };
      },
    },
  });

export const textOf = (html) => sanitizeHtml(String(html ?? ''), { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();

/** Minutes to read at ~200 words per minute, at least 1. */
export const readingTimeOf = (html) => Math.max(1, Math.ceil(textOf(html).split(' ').filter(Boolean).length / 200));
