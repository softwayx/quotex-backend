import ApiError from '../utils/apiError.js';

/**
 * validate({ params, query, body }) — each a Zod schema. Parsed values replace the raw ones.
 * A failure answers 422 VALIDATION with the first issue's message (what the forms show).
 */
export default (schemas) => (req, _res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const issues = result.error.issues.map((issue) => ({ in: part, path: issue.path.join('.'), message: issue.message }));
      return next(ApiError.validation(issues[0].message, issues));
    }
    req[part] = result.data;
  }
  return next();
};
