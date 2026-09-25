import { Router } from 'express';
import requirePermission from '../../../middlewares/requirePermission.js';
import validate from '../../../middlewares/validate.js';
import { PERMISSIONS } from '../../../domain/rbac/permissions.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './plans.controller.js';
import { listPlansQuery, planFeaturesSchema, planIdParams, updatePlanSchema } from './plans.schema.js';

/** Mounted at /admin: serves /plans and /plan-features. */
const router = Router();
router.use(['/plans', '/plan-features'], requirePermission(PERMISSIONS.PLANS_MANAGE));

router.get('/plans', validate({ query: listPlansQuery }), asyncHandler(controller.list));
router.patch('/plans/:id', validate({ params: planIdParams, body: updatePlanSchema }), asyncHandler(controller.update));
router.get('/plan-features', asyncHandler(controller.features));
router.put('/plan-features', validate({ body: planFeaturesSchema }), asyncHandler(controller.updateFeatures));

export default router;
