import { Inject, Injectable } from "@nestjs/common";
import type { AuthSession } from "@authentik/auth/nest";
import { AUTH } from "../better-auth/better-auth.module.js";
import type { NexusAuth } from "../better-auth/create-auth.js";
import { isUuid } from "../common/uuid.js";
import { lookupMemberBranchIds, lookupMemberContext } from "../members/member-lookup.js";
import { isOrgEntitled } from "../organizations/entitlements.js";
import { getOrgSettings } from "../organizations/settings.js";
import { AdminError } from "../members/errors.js";
import { AUTHENTIK_APP } from "../applications/app-keys.js";

export type SessionRequest = {
  cookie?: string | null;
  authorization?: string | null;
  /** Application whose grants to load. */
  appKey?: string | null;
  /** Organization to resolve membership for; defaults to the session's active one. */
  organizationId?: string | null;
};

/** In-process session resolution: Better Auth session + membership + the calling application's grants. */
@Injectable()
export class SessionService {
  constructor(@Inject(AUTH) private readonly auth: NexusAuth) {}

  async getSession(init: SessionRequest): Promise<AuthSession | null> {
    const headers = new Headers();
    if (init.cookie) headers.set("cookie", init.cookie);
    if (init.authorization) headers.set("authorization", init.authorization);
    const raw = await this.auth.api.getSession({ headers });
    if (!raw?.user) return null;

    const app = init.appKey || AUTHENTIK_APP;
    const fromSession = (raw.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null;
    const organizationId = init.organizationId || fromSession;
    const valid = organizationId && isUuid(organizationId) ? organizationId : null;
    const membership = valid ? await lookupMemberContext(raw.user.id, valid, app) : null;
    const entitled = valid ? await isOrgEntitled(valid, app) : undefined;
    if (valid && entitled) {
      const policy = await getOrgSettings(valid);
      const started = new Date((raw.session as { createdAt: string | Date }).createdAt).getTime();
      // An organization may cap how long a sign-in stays valid for its applications.
      if (policy.sessionMaxAgeSeconds && Date.now() - started > policy.sessionMaxAgeSeconds * 1000) return null;
      if (policy.requireTwoFactor && !(raw.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled) {
        throw new AdminError(403, "two_factor_required", "This organization requires two-factor authentication");
      }
    }
    // Branch scoping is a Nexus concept; a read error propagates so callers fail closed.
    const branchIds = membership && app === AUTHENTIK_APP ? await lookupMemberBranchIds(membership.id) : [];

    return {
      user: {
        id: raw.user.id,
        email: raw.user.email ?? null,
        name: raw.user.name ?? null,
        role: (raw.user as { role?: string | null }).role ?? null,
      },
      session: { ...(raw.session as Record<string, unknown>), activeOrganizationId: organizationId },
      memberId: membership?.id ?? null,
      memberRole: membership?.role ?? null,
      permissions: membership?.permissions.length ? membership.permissions : undefined,
      branchIds: branchIds.length ? branchIds : undefined,
      resolvedOrganizationId: valid,
      entitled,
    };
  }
}
