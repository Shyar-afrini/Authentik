import {
  adminClient,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient as createBetterAuthClient } from "better-auth/react";

type NexusAuthClient = ReturnType<typeof createBetterAuthClient>;

export function createAuthClient(options?: {
  baseURL?: string;
}): NexusAuthClient {
  return createBetterAuthClient({
    baseURL: options?.baseURL ?? process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    plugins: [organizationClient(), adminClient()],
  }) as NexusAuthClient;
}

export const authClient: NexusAuthClient = createAuthClient();
