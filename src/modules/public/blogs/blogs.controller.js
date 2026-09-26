import { ok } from '../../../utils/apiResponse.js';
import * as service from './blogs.service.js';

export const list = async (req, res) => ok(res, await service.listPublished(req.query));

export const featured = async (_req, res) => ok(res, { items: await service.listFeatured() });

export const categories = async (_req, res) => ok(res, { items: await service.listCategories() });

export const sitemap = async (_req, res) => ok(res, { items: await service.listForSitemap() });

export const detail = async (req, res) => ok(res, await service.getPublished(req.params.slug));

export const view = async (req, res) => {
  await service.countView(req.params.slug);
  ok(res);
};
