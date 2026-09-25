import { Router } from 'express';
import validate from '../../../middlewares/validate.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './history.controller.js';
import { historyQuery, sessionParams } from './history.schema.js';

const router = Router();

router.get('/', validate({ query: historyQuery }), asyncHandler(controller.list));
router.get('/:sessionId', validate({ params: sessionParams }), asyncHandler(controller.detail));

export default router;
