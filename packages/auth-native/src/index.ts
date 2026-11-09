import { expoClient } from "@better-auth/expo/client";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export type NexusNativeOptions = {
  /** Base URL of the Authentik server, e.g. https://auth.example.com */
  authUrl: string;
  /** Deep-link scheme of the app (app.json `scheme`); must be listed in the server's AUTH_TRUSTED_ORIGINS, e.g. `myapp://`. */
  scheme: string;
  /** Key/value storage for the session token; pass `expo-secure-store` (`import * as SecureStore`). */
  storage: NonNullable<Parameters<typeof expoClient>[0]["storage"]>;
  /** Prefix for stored keys. Defaults to `authentik`. */
  storagePrefix?: string;
};

/**
 * Auth client for a React Native app. Sign in with `client.signIn.email(...)`; to call your own
 * backend, send `authHeaders(client)` — that backend then asks the Authentik server who the caller is.
 * The application key is never shipped in a mobile app: it belongs to your backend.
 */
export function createNexusNativeClient(options: NexusNativeOptions) {
  return createAuthClient({
    baseURL: options.authUrl.replace(/\/$/, ""),
    plugins: [
      expoClient({ scheme: options.scheme, storagePrefix: options.storagePrefix ?? "authentik", storage: options.storage }),
      organizationClient(),
    ],
  });
}

export type NexusNativeClient = ReturnType<typeof createNexusNativeClient>;

/** Headers that identify the signed-in user to your backend (and to the auth server). */
export function authHeaders(client: NexusNativeClient, organizationId?: string): Record<string, string> {
  const cookie = (client as unknown as { getCookie(): string }).getCookie();
  return {
    ...(cookie ? { cookie } : {}),
    ...(organizationId ? { "x-organization-id": organizationId } : {}),
  };
}
