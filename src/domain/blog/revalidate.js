import env from '../../config/env.js';
import logger from '../../utils/logger.js';

/**
 * Asks the website to refresh its cached blog pages (Next.js on-demand revalidation). Runs after the
 * change is saved; a failure is only logged, the admin's request still succeeds.
 */
export const revalidateBlog = async ({ slug, previousSlugs = [], category }) => {
  if (!env.REVALIDATE_SECRET) return;
  const url = `${env.SITE_URL.replace(/\/+$/, '')}/api/revalidate?secret=${encodeURIComponent(env.REVALIDATE_SECRET)}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, previousSlugs, category }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) logger.warn({ status: response.status, slug }, 'blog revalidation refused');
  } catch (error) {
    logger.warn({ err: error.message, slug }, 'blog revalidation failed');
  }
};
