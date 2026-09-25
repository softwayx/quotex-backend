import { Router } from 'express';
import requirePermission from '../../../middlewares/requirePermission.js';
import validate from '../../../middlewares/validate.js';
import { PERMISSIONS } from '../../../domain/rbac/permissions.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './referrals.controller.js';
import { referralSettingsSchema } from './referrals.schema.js';

const router = Router();
router.use(requirePermission(PERMISSIONS.REFERRALS_MANAGE));

router.get('/', asyncHandler(controller.view));
router.put('/', validate({ body: referralSettingsSchema }), asyncHandler(controller.update));

export default router;
