import { Router } from 'express';
import validate from '../../../middlewares/validate.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './auth.controller.js';
import { loginSchema, loginVerifySchema, registerSchema, registerVerifySchema } from './auth.schema.js';

const router = Router();

router.post('/register/start', validate({ body: registerSchema }), asyncHandler(controller.registerStart));
router.post('/register/verify', validate({ body: registerVerifySchema }), asyncHandler(controller.registerVerify));
router.post('/login', validate({ body: loginSchema }), asyncHandler(controller.login));
router.post('/login/verify', validate({ body: loginVerifySchema }), asyncHandler(controller.loginVerify));
router.post('/logout', asyncHandler(controller.logout));

export default router;
