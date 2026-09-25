import { Router } from 'express';
import validate from '../../../middlewares/validate.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './settings.controller.js';
import { flexibleSettingsSchema, protectedSettingsSchema } from './settings.schema.js';

const router = Router();

router.get('/', asyncHandler(controller.view));
router.patch('/flexible', validate({ body: flexibleSettingsSchema }), asyncHandler(controller.saveFlexible));
router.put('/protected', validate({ body: protectedSettingsSchema }), asyncHandler(controller.commitProtected));

export default router;
