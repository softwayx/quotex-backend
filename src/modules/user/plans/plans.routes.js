import { Router } from 'express';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './plans.controller.js';

const router = Router();

router.get('/', asyncHandler(controller.page));

export default router;
