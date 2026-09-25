/** Expected, user-facing failure. Anything else is answered as a 500. */
export default class ApiError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static unauthorized() {
    return new ApiError('UNAUTHORIZED', 'Login required.', 401);
  }

  static forbidden(message = 'Not allowed.') {
    return new ApiError('FORBIDDEN', message, 403);
  }

  static notFound(message = 'Not found.') {
    return new ApiError('NOT_FOUND', message, 404);
  }

  static validation(message, details) {
    return new ApiError('VALIDATION', message, 422, details);
  }

  static conflict(code, message) {
    return new ApiError(code, message, 409);
  }
}
