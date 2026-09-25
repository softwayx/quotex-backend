import { Router } from 'express';
import requirePermission from '../../../middlewares/requirePermission.js';
import validate from '../../../middlewares/validate.js';
import { PERMISSIONS } from '../../../domain/rbac/permissions.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './settings.controller.js';
import { communityFeatureSchema, lockSettingsSchema, recommendedSettingsSchema } from './settings.schema.js';

/** Mounted at /admin: /recommended-settings, /lock-settings, /community-settings. */
const router = Router();
router.use(['/recommended-settings', '/lock-settings', '/community-settings'], requirePermission(PERMISSIONS.SETTINGS_MANAGE));

router.get('/recommended-settings', asyncHandler(controller.recommended));
router.put('/recommended-settings', validate({ body: recommendedSettingsSchema }), asyncHandler(controller.updateRecommended));
router.get('/lock-settings', asyncHandler(controller.lock));
router.put('/lock-settings', validate({ body: lockSettingsSchema }), asyncHandler(controller.updateLock));
router.get('/community-settings', asyncHandler(controller.community));
router.put('/community-settings', validate({ body: communityFeatureSchema }), asyncHandler(controller.updateCommunity));

export default router;
