import { ok } from '../../../utils/apiResponse.js';
import * as service from './settings.service.js';

export const recommended = async (_req, res) => ok(res, await service.getRecommendedSettings());

export const updateRecommended = async (req, res) => ok(res, await service.updateRecommendedSettings(req.admin.id, req.body));

export const lock = async (_req, res) => ok(res, { lockMinHours: await service.getLockMinHours() });

export const updateLock = async (req, res) => ok(res, { lockMinHours: await service.updateLockMinHours(req.admin.id, req.body.lockMinHours) });

export const community = async (_req, res) => ok(res, { enabled: await service.getCommunityFeatureEnabled() });

export const updateCommunity = async (req, res) => ok(res, { enabled: await service.updateCommunityFeatureEnabled(req.admin.id, req.body.enabled) });
