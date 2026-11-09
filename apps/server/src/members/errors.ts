/** HTTP-shaped error thrown by the member admin services; the router maps it to `{ code, message }`. */
export class AdminError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class BadRequestException extends AdminError {
  constructor(message: string) {
    super(400, "bad_request", message);
  }
}
export class ForbiddenException extends AdminError {
  constructor(message: string) {
    super(403, "forbidden", message);
  }
}
export class NotFoundException extends AdminError {
  constructor(message: string) {
    super(404, "not_found", message);
  }
}
export class ConflictException extends AdminError {
  constructor(message: string) {
    super(409, "conflict", message);
  }
}
