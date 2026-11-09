"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  can as canAbility,
  type AbilityPrincipal,
  type Actions,
  type Subjects,
} from "./ability.js";
import { authClient } from "./auth-client.js";

type MeResponse = {
  user?: {
    id?: string | null;
    role?: string | null;
  } | null;
  memberRole?: string | null;
  permissions?: AbilityPrincipal["permissions"];
};

let abilityEpoch = 0;
const abilityListeners = new Set<() => void>();

function subscribeAbilityEpoch(onStoreChange: () => void) {
  abilityListeners.add(onStoreChange);
  return () => {
    abilityListeners.delete(onStoreChange);
  };
}

function getAbilityEpoch() {
  return abilityEpoch;
}

/** Bump after role / permission matrix saves so all `useCan` hooks refetch. */
export function invalidateAbilityCache() {
  abilityEpoch += 1;
  for (const listener of abilityListeners) {
    listener();
  }
}

/** The member/permission API is served by the auth server (`/api/v1/auth/*`). */
function authApiBase(): string {
  if (typeof window !== "undefined") return "/api/v1/auth";
  const origin = (process.env.AUTHENTIK_URL?.trim() || "http://127.0.0.1:3005").replace(/\/$/, "");
  return `${origin}/api/v1/auth`;
}

async function loadPrincipal(): Promise<AbilityPrincipal | null> {
  try {
    const res = await fetch(`${authApiBase()}/me`, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as MeResponse;
      if (data.user?.id) {
        return {
          user: {
            id: data.user.id,
            role: data.user.role ?? null,
          },
          memberRole: data.memberRole ?? null,
          permissions: data.permissions,
        };
      }
    }
  } catch {
    // Fall through to Better Auth session (no memberRole).
  }

  const { data } = await authClient.getSession();
  const snap = data as MeResponse | null;
  if (!snap?.user?.id) return null;
  return {
    user: {
      id: snap.user.id,
      role: snap.user.role ?? null,
    },
    memberRole: snap.memberRole ?? null,
    permissions: snap.permissions,
  };
}

/**
 * Client-side ability check aligned with Nest `@RequireAbility`.
 *
 * Loads `GET /api/v1/auth/me` so `memberRole` / permissions match Nest CASL
 * (Better Auth session cookies alone do not carry org membership role).
 * Call {@link invalidateAbilityCache} after admin permission/role changes.
 */
export function useAbility(): {
  can: (action: Actions, subject: Subjects) => boolean;
  ready: boolean;
} {
  const epoch = useSyncExternalStore(
    subscribeAbilityEpoch,
    getAbilityEpoch,
    getAbilityEpoch,
  );
  const [principal, setPrincipal] = useState<AbilityPrincipal | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadPrincipal().then((next) => {
      if (cancelled) return;
      setPrincipal(next);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [epoch]);

  const can = useCallback(
    (action: Actions, subject: Subjects) => {
      if (!principal?.user?.id) return false;
      return canAbility(principal, action, subject);
    },
    [principal],
  );
  return { can, ready };
}

export function useCan(): (action: Actions, subject: Subjects) => boolean {
  return useAbility().can;
}
