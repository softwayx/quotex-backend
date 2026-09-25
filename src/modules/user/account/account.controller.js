import { ok } from '../../../utils/apiResponse.js';
import { setLanguageCookie } from '../../../utils/cookies.js';
import * as service from './account.service.js';

export const me = async (req, res) => ok(res, await service.getAccount(req.user));

export const updatePreferences = async (req, res) => {
  const saved = await service.updateUserPreferences(req.user.id, req.body);
  setLanguageCookie(res, saved.language);
  ok(res, saved);
};

export const getLocation = async (req, res) => ok(res, await service.getLocation(req.user.id));

export const setLocation = async (req, res) =>
  ok(res, 'countryCode' in req.body ? await service.chooseCountry(req.user, req.body.countryCode) : await service.detectLocation(req.user, req.body));
