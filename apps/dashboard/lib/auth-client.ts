"use client";

import { createAuthClient } from "better-auth/react";

/** Same-origin: next.config.js proxies /api/auth to the auth server. */
export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? "http://localhost:3006" : window.location.origin,
});
