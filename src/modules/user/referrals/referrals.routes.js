import { Router } from 'express';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './referrals.controller.js';

const router = Router();

router.get('/', asyncHandler(controller.view));

export default router;
