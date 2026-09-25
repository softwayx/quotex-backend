import { Router } from 'express';
import validate from '../../../middlewares/validate.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './analytics.controller.js';
import { insightsQuery } from './analytics.schema.js';

const router = Router();

router.get('/weekly', asyncHandler(controller.weekly));
router.get('/insights', validate({ query: insightsQuery }), asyncHandler(controller.insights));

export default router;
