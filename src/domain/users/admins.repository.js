import { Admin, toRow } from '../../models/index.js';

export const findAdminById = async (id) => toRow(await Admin.findById(id, 'username role created_at').lean());

export const findAdminForLogin = async (username) =>
  toRow(await Admin.findOne({ username }, 'username role password_hash failed_attempts login_locked_until').lean());
