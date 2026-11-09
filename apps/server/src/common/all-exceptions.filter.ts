import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from "@nestjs/common";
import type { Response } from "express";
import { RegistryError } from "../applications/registry.js";
import { AdminError } from "../members/errors.js";
import { requestContext } from "./request-context.js";

/** Every error leaves as `{ code, message }`; internals are logged with the request id, never returned. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const send = (status: number, code: string, message: string, extra: object = {}) =>
      res.headersSent ? res.end() : res.status(status).json({ code, message, ...extra });

    if (error instanceof RegistryError || error instanceof AdminError) return send(error.status, error.code, error.message);
    // Ids are uuids; a malformed one in a path or body is the caller's error, not a server fault.
    const e = error as { code?: string; cause?: { code?: string }; type?: string; status?: number };
    if ((e.cause?.code ?? e.code) === "22P02") return send(400, "bad_request", "Invalid identifier");
    if (e.type === "entity.too.large") return send(413, "payload_too_large", "Body too large");
    if (e.type === "entity.parse.failed" || error instanceof SyntaxError) return send(400, "bad_request", "Invalid JSON");
    if (error instanceof HttpException) {
      const status = error.getStatus();
      return send(status, status === 404 ? "not_found" : status === 405 ? "method_not_allowed" : status === 400 ? "bad_request" : "http_error", error.message);
    }
    const requestId = requestContext()?.requestId;
    console.error(JSON.stringify({ level: "error", msg: "request failed", requestId, error: String((error as Error)?.stack ?? error) }));
    return send(500, "internal_error", "Internal error", { requestId });
  }
}
