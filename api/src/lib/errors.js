export class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function sendError(reply, err) {
  if (err instanceof ApiError) {
    return reply.code(err.statusCode).send({ error: err.code, message: err.message });
  }
  reply.log.error(err);
  return reply.code(500).send({ error: 'internal_error', message: 'Unexpected server error' });
}
