import { Router } from 'express';
import validate from '../../../middlewares/validate.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './payments.controller.js';
import { createOrderSchema, verifyPaymentSchema } from './payments.schema.js';

const router = Router();

router.post('/create-order', validate({ body: createOrderSchema }), asyncHandler(controller.createOrder));
router.post('/verify', validate({ body: verifyPaymentSchema }), asyncHandler(controller.verify));

export default router;
