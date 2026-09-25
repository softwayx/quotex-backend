import { Router } from 'express';
import validate from '../../../middlewares/validate.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './session.controller.js';
import { changePayoutSchema, finishSchema, recordTradeSchema, startSessionSchema } from './session.schema.js';

const router = Router();

router.get('/', asyncHandler(controller.dashboard));
router.post('/start', validate({ body: startSessionSchema }), asyncHandler(controller.start));
router.post('/trade', validate({ body: recordTradeSchema }), asyncHandler(controller.trade));
router.patch('/payout', validate({ body: changePayoutSchema }), asyncHandler(controller.payout));
router.post('/finish', validate({ body: finishSchema }), asyncHandler(controller.finish));

export default router;
