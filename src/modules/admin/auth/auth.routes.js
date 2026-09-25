import { Router } from 'express';
import { authAdmin } from '../../../middlewares/authenticate.js';
import validate from '../../../middlewares/validate.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './auth.controller.js';
import { loginSchema } from './auth.schema.js';

const router = Router();

router.post('/login', validate({ body: loginSchema }), asyncHandler(controller.login));
router.post('/logout', asyncHandler(controller.logout));
router.get('/me', authAdmin, controller.me);

export default router;
