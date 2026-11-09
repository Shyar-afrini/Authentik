import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { observeRequest, routeGroup } from "./metrics.js";
import { runWithRequestContext, type RequestContext } from "./request-context.js";

/** Request id, per-request audit context, access log and metrics. */
export function requestContextMiddleware(logRequests: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.headers["x-request-id"];
    const supplied = Array.isArray(incoming) ? incoming[0] : incoming;
    // A caller's id is accepted only if short and printable; it ends up in logs and audit rows.
    const requestId = supplied && /^[\w.:-]{8,64}$/.test(supplied) ? supplied : randomUUID();
    const started = process.hrtime.bigint();
    const path = req.path;
    res.setHeader("x-request-id", requestId);
    const ctx: RequestContext = { requestId, ip: req.socket.remoteAddress ?? undefined };
    res.on("finish", () => {
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      const group = routeGroup(path);
      observeRequest(group, req.method, res.statusCode, seconds);
      // Only the path is logged: query strings carry OAuth codes and tokens.
      if (logRequests && group !== "ops") {
        console.log(
          JSON.stringify({ level: "info", msg: "request", requestId, method: req.method, path, status: res.statusCode, ms: Math.round(seconds * 1000), actor: ctx.actorUserId }),
        );
      }
    });
    runWithRequestContext(ctx, () => next());
  };
}
