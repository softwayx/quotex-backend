import { ADMIN_ROLES } from '../../config/constants.js';

export const PERMISSIONS = Object.freeze({
  USERS_MANAGE: 'users.manage',
  PLANS_MANAGE: 'plans.manage',
  SETTINGS_MANAGE: 'settings.manage',
  PAYMENTS_MANAGE: 'payments.manage',
  MESSAGING_MANAGE: 'messaging.manage',
  REFERRALS_MANAGE: 'referrals.manage',
  AUDIT_READ: 'audit.read',
});

const ROLE_PERMISSIONS = {
  [ADMIN_ROLES.SUPER_ADMIN]: new Set(Object.values(PERMISSIONS)),
};

export const can = (role, permission) => ROLE_PERMISSIONS[role]?.has(permission) ?? false;
