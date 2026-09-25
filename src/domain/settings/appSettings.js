import { AppSettings, SINGLETON_ID } from '../../models/index.js';

const read = (session) => AppSettings.findById(SINGLETON_ID, null, { session }).lean();

const save = (set, adminId, session) =>
  AppSettings.findOneAndUpdate({ _id: SINGLETON_ID }, { $set: { ...set, updated_by: adminId } }, { returnDocument: 'after', session, lean: true });

export const getLockMinHours = async (session) => (await read(session)).lock_min_hours;

export const saveLockMinHours = async (hours, adminId, session) => (await save({ lock_min_hours: hours }, adminId, session)).lock_min_hours;

export const getCommunityFeatureEnabled = async (session) => (await read(session)).community_feature_enabled;

export const saveCommunityFeatureEnabled = async (enabled, adminId, session) =>
  (await save({ community_feature_enabled: enabled }, adminId, session)).community_feature_enabled;
