import { Router } from 'express';
import validate from '../../../middlewares/validate.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './account.controller.js';
import { locationSchema, preferencesSchema } from './account.schema.js';

const router = Router();

router.get('/me', asyncHandler(controller.me));
router.patch('/preferences', validate({ body: preferencesSchema }), asyncHandler(controller.updatePreferences));
router.get('/location', asyncHandler(controller.getLocation));
router.post('/location', validate({ body: locationSchema }), asyncHandler(controller.setLocation));

export default router;
