import { createHash } from 'node:crypto';
import env from '../../config/env.js';
import ApiError from '../../utils/apiError.js';
import logger from '../../utils/logger.js';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** The real file type from its first bytes (a renamed file cannot pass). */
const detectType = (buffer) => {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
};

const configured = () => Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

/** Uploads a JPG/PNG/WebP (max 2 MB) to Cloudinary with a signed request. Returns `{ url, width, height }`. */
export const uploadBlogImage = async (file) => {
  if (!file?.buffer?.length) throw ApiError.validation('Choose an image to upload.');
  if (file.buffer.length > MAX_IMAGE_BYTES) throw ApiError.validation('The image must be 2 MB or smaller.');
  const type = detectType(file.buffer);
  if (!type) throw ApiError.validation('Only JPG, PNG or WebP images are allowed.');
  if (!configured()) throw new ApiError('UPLOAD_UNAVAILABLE', 'Image upload is not set up yet (Cloudinary keys missing).', 503);

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = env.CLOUDINARY_FOLDER;
  // Cloudinary signature: SHA-1 of the sorted parameters followed by the API secret.
  const signature = createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`).digest('hex');

  const form = new FormData();
  form.append('file', new Blob([file.buffer], { type }), file.originalname || 'image');
  form.append('api_key', env.CLOUDINARY_API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', signature);

  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    logger.error({ err: error.message }, 'cloudinary unreachable');
    throw new ApiError('UPLOAD_FAILED', 'Could not reach the image service. Try again.', 502);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.secure_url) {
    logger.error({ status: response.status, error: body?.error?.message }, 'cloudinary upload refused');
    throw new ApiError('UPLOAD_FAILED', 'The image service refused the upload.', 502);
  }
  return { url: body.secure_url, width: body.width, height: body.height };
};
