import { created, ok } from '../../../utils/apiResponse.js';
import * as service from './messaging.service.js';

export const settings = async (_req, res) => ok(res, await service.getMessagingSettingsView());

export const updateSettings = async (req, res) => ok(res, await service.updateMessagingSettings(req.admin.id, req.body));

export const testEmail = async (req, res) => {
  await service.sendTestEmail(req.body.to);
  ok(res, { sent: true });
};

export const listSessions = async (_req, res) => ok(res, { sessions: await service.listSessionsView() });

export const addSession = async (req, res) => created(res, { session: await service.addSession(req.admin.id, req.body.label) });

/** Polled by the admin page while a QR is on screen. */
export const getSession = async (req, res) => ok(res, { session: await service.getSessionLive(req.params.id) });

export const sessionAction = async (req, res) => {
  await service.runSessionAction(req.admin.id, req.params.id, req.body);
  ok(res, { done: true });
};

export const removeSession = async (req, res) => {
  await service.removeSession(req.admin.id, req.params.id);
  ok(res, { done: true });
};
