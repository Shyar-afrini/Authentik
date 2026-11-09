/** Header an application sends with its secret key (`nak_<app>_<64 hex>`). */
export const APP_KEY_HEADER = "x-authentik-app-key";

const KEY_RE = /^nak_([a-z][a-z0-9-]{1,39})_([0-9a-f]{64})$/;

/** The application a secret key belongs to, or null when the string is not a key. */
export function parseAppKey(raw: string | null | undefined): { app: string; secret: string } | null {
  const m = KEY_RE.exec(raw?.trim() ?? "");
  return m ? { app: m[1]!, secret: m[2]! } : null;
}
