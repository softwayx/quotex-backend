import { Router } from 'express';
import validate from '../../../middlewares/validate.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './blogs.controller.js';
import { listQuery, slugParams } from './blogs.schema.js';

/** Published posts only. No login. */
const router = Router();

router.get('/', validate({ query: listQuery }), asyncHandler(controller.list));
router.get('/featured', asyncHandler(controller.featured));
router.get('/categories', asyncHandler(controller.categories));
router.get('/sitemap', asyncHandler(controller.sitemap));
router.get('/:slug', validate({ params: slugParams }), asyncHandler(controller.detail));
router.post('/:slug/view', validate({ params: slugParams }), asyncHandler(controller.view));

export default router;
