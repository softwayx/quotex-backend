import { Router } from 'express';
import validate from '../../../middlewares/validate.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './invite.controller.js';
import { inviteQuery } from './invite.schema.js';

const router = Router();

router.get('/', validate({ query: inviteQuery }), asyncHandler(controller.invite));

export default router;
