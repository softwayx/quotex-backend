import { Router } from 'express';
import requirePermission from '../../../middlewares/requirePermission.js';
import { PERMISSIONS } from '../../../domain/rbac/permissions.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './overview.controller.js';

const router = Router();

router.get('/', requirePermission(PERMISSIONS.USERS_MANAGE), asyncHandler(controller.overview));

export default router;
