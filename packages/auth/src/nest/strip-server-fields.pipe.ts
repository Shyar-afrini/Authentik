import { Injectable, type ArgumentMetadata, type PipeTransform } from "@nestjs/common";

/** Columns the server owns; a client must never set them through a request body. */
const SERVER_OWNED_FIELDS = new Set([
  "id",
  "organizationId",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "createdBy",
  "updatedBy",
  "approvedBy",
  "approvedAt",
  "postedBy",
  "postedAt",
]);

function stripTenant(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripTenant);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "organizationId") continue;
      out[k] = stripTenant(v);
    }
    return out;
  }
  return value;
}

/**
 * Mass-assignment guard for controllers that still take free-form bodies
 * (`Record<string, unknown>`): drops server-owned fields before they reach
 * `insert(...).values({ organizationId, ...rest })`-style code, where a
 * client-supplied `organizationId` would otherwise override the session org.
 * `organizationId` is removed at every depth; other server-owned keys at the top level.
 * Prefer typed DTOs; this is the safety net underneath them.
 */
@Injectable()
export class StripServerFieldsPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== "body" || !value || typeof value !== "object") {
      return value;
    }
    const cleaned = stripTenant(value);
    if (Array.isArray(cleaned)) return cleaned;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(cleaned as Record<string, unknown>)) {
      if (SERVER_OWNED_FIELDS.has(k)) continue;
      out[k] = v;
    }
    return out;
  }
}
