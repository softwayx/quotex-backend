import { Router } from 'express';
import multer from 'multer';
import { MAX_IMAGE_BYTES } from '../../../domain/blog/imageUpload.js';
import { PERMISSIONS } from '../../../domain/rbac/permissions.js';
import requirePermission from '../../../middlewares/requirePermission.js';
import validate from '../../../middlewares/validate.js';
import ApiError from '../../../utils/apiError.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import * as controller from './blogs.controller.js';
import { adminListQuery, blogIdParams, blogSchema, statusSchema } from './blogs.schema.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } });

/** One `image` field in memory; an oversized file becomes a normal validation error. */
const imageField = (req, res, next) =>
  upload.single('image')(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') return next(ApiError.validation('The image must be 2 MB or smaller.'));
    if (error) return next(ApiError.validation('Upload one image in the "image" field.'));
    return next();
  });

/** Super admin only. */
const router = Router();
router.use(requirePermission(PERMISSIONS.BLOGS_MANAGE));

router.get('/', validate({ query: adminListQuery }), asyncHandler(controller.list));
router.post('/', validate({ body: blogSchema }), asyncHandler(controller.create));
router.post('/upload-image', imageField, asyncHandler(controller.uploadImage));
router.get('/:id', validate({ params: blogIdParams }), asyncHandler(controller.detail));
router.put('/:id', validate({ params: blogIdParams, body: blogSchema }), asyncHandler(controller.update));
router.patch('/:id/status', validate({ params: blogIdParams, body: statusSchema }), asyncHandler(controller.setStatus));
router.delete('/:id', validate({ params: blogIdParams }), asyncHandler(controller.remove));

export default router;
