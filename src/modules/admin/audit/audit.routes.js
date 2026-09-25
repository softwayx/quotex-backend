import { Router } from 'express';
import requirePermission from '../../../middlewares/requirePermission.js';
import validate from '../../../middlewares/validate.js';
import { PERMISSIONS } from '../../../domain/rbac/permissions.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './audit.controller.js';
import { auditQuery } from './audit.schema.js';

const router = Router();

router.get('/', requirePermission(PERMISSIONS.AUDIT_READ), validate({ query: auditQuery }), asyncHandler(controller.list));

export default router;
