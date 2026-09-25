import { Router } from 'express';
import validate from '../../../middlewares/validate.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './community.controller.js';
import { boardQuery } from './community.schema.js';

const router = Router();

router.get('/', asyncHandler(controller.status));
router.get('/board', validate({ query: boardQuery }), asyncHandler(controller.board));

export default router;
