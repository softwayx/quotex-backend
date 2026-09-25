import { can } from '../domain/rbac/permissions.js';
import ApiError from '../utils/apiError.js';

/** Use after `authAdmin`. */
export default (permission) => (req, _res, next) => next(can(req.admin?.role, permission) ? undefined : ApiError.forbidden());
