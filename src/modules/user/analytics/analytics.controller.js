import { ok } from '../../../utils/apiResponse.js';
import * as service from './analytics.service.js';

export const weekly = async (req, res) => ok(res, await service.getWeeklyAnalytics(req.user.id));

export const insights = async (req, res) => ok(res, await service.getInsightsView(req.user.id, req.query.days));
