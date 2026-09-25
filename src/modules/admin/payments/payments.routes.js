import { Router } from 'express';
import requirePermission from '../../../middlewares/requirePermission.js';
import validate from '../../../middlewares/validate.js';
import { PERMISSIONS } from '../../../domain/rbac/permissions.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './payments.controller.js';
import { paymentSettingsSchema } from './payments.schema.js';

/** Mounted at /admin: /payments and /payment-settings. */
const router = Router();
router.use(['/payments', '/payment-settings'], requirePermission(PERMISSIONS.PAYMENTS_MANAGE));

router.get('/payments', asyncHandler(controller.page));
router.get('/payment-settings', asyncHandler(controller.settings));
router.put('/payment-settings', validate({ body: paymentSettingsSchema }), asyncHandler(controller.updateSettings));
router.post('/payment-settings/test', asyncHandler(controller.testConnection));

export default router;
