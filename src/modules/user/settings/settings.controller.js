import { ok } from '../../../utils/apiResponse.js';
import * as service from './settings.service.js';

export const view = async (req, res) => ok(res, await service.getSettingsView(req.user.id));

export const saveFlexible = async (req, res) => ok(res, await service.saveFlexibleSettings(req.user.id, req.body));

export const commitProtected = async (req, res) => ok(res, await service.commitProtectedSettings(req.user.id, req.body));
