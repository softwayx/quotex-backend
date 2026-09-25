import { Router } from 'express';
import requirePermission from '../../../middlewares/requirePermission.js';
import validate from '../../../middlewares/validate.js';
import { PERMISSIONS } from '../../../domain/rbac/permissions.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './messaging.controller.js';
import { emailTestSchema, messagingSettingsSchema, whatsappActionSchema, whatsappIdParams, whatsappSessionSchema } from './messaging.schema.js';

/** Mounted at /admin: /messaging-settings and /whatsapp/sessions. */
const router = Router();
router.use(['/messaging-settings', '/whatsapp'], requirePermission(PERMISSIONS.MESSAGING_MANAGE));

router.get('/messaging-settings', asyncHandler(controller.settings));
router.put('/messaging-settings', validate({ body: messagingSettingsSchema }), asyncHandler(controller.updateSettings));
router.post('/messaging-settings/test', validate({ body: emailTestSchema }), asyncHandler(controller.testEmail));

router.get('/whatsapp/sessions', asyncHandler(controller.listSessions));
router.post('/whatsapp/sessions', validate({ body: whatsappSessionSchema }), asyncHandler(controller.addSession));
router.get('/whatsapp/sessions/:id', validate({ params: whatsappIdParams }), asyncHandler(controller.getSession));
router.post('/whatsapp/sessions/:id', validate({ params: whatsappIdParams, body: whatsappActionSchema }), asyncHandler(controller.sessionAction));
router.delete('/whatsapp/sessions/:id', validate({ params: whatsappIdParams }), asyncHandler(controller.removeSession));

export default router;
