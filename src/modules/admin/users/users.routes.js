import { Router } from 'express';
import requirePermission from '../../../middlewares/requirePermission.js';
import validate from '../../../middlewares/validate.js';
import { PERMISSIONS } from '../../../domain/rbac/permissions.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './users.controller.js';
import {
  adjustExpirySchema,
  assignPlanSchema,
  communityAccessSchema,
  countrySchema,
  listUsersQuery,
  unlockSchema,
  userIdParams,
  userStatusSchema,
} from './users.schema.js';

const router = Router();
router.use(requirePermission(PERMISSIONS.USERS_MANAGE));

const withUser = (body) => validate({ params: userIdParams, ...(body && { body }) });

router.get('/', validate({ query: listUsersQuery }), asyncHandler(controller.list));
router.get('/:id', withUser(), asyncHandler(controller.detail));
router.delete('/:id', withUser(), asyncHandler(controller.remove));
router.post('/:id/assign-plan', withUser(assignPlanSchema), asyncHandler(controller.assignPlan));
router.post('/:id/adjust-expiry', withUser(adjustExpirySchema), asyncHandler(controller.adjustExpiry));
router.post('/:id/revoke-plan', withUser(), asyncHandler(controller.revokePlan));
router.post('/:id/status', withUser(userStatusSchema), asyncHandler(controller.setStatus));
router.post('/:id/unlock', withUser(unlockSchema), asyncHandler(controller.unlock));
router.post('/:id/community-access', withUser(communityAccessSchema), asyncHandler(controller.communityAccess));
router.post('/:id/country', withUser(countrySchema), asyncHandler(controller.country));

export default router;
