import { isUuid } from "../common/uuid.js";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { AuthDB } from "../database/index.js";
import { member, organization } from "../database/schema/organization.js";

export type EnsureOrganizationInput = {
  organizationId: string;
  name?: string;
  slug?: string;
};

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "org"
  );
}

/** Upsert `auth.organization` with the domain (accounting) org id. */
export async function ensureAuthOrganization(input: EnsureOrganizationInput) {
  if (!isUuid(input.organizationId.trim())) throw new Error("organizationId must be a uuid");
  const id = input.organizationId.trim();
  if (!id) throw new Error("organizationId is required");

  const [existing] = await AuthDB.select()
    .from(organization)
    .where(eq(organization.id, id))
    .limit(1);

  if (existing) {
    if (input.name && input.name !== existing.name) {
      const [updated] = await AuthDB.update(organization)
        .set({ name: input.name })
        .where(eq(organization.id, id))
        .returning();
      return updated ?? existing;
    }
    return existing;
  }

  const name = input.name?.trim() || "Organization";
  const baseSlug = input.slug?.trim() || slugify(name);
  let slug = baseSlug;
  let attempt = 0;
  while (attempt < 8) {
    const [slugTaken] = await AuthDB.select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, slug))
      .limit(1);
    if (!slugTaken) break;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  const [created] = await AuthDB.insert(organization)
    .values({
      id,
      name,
      slug,
      createdAt: new Date(),
    })
    .returning();
  return created!;
}

/** Ensure a user is a member of the org (default role owner). */
export async function ensureOrgMember(
  input: {
    organizationId: string;
    userId: string;
    role?: string;
    /** Also demote/change an existing member's role (explicit provisioning only). */
    setRole?: boolean;
  },
  db: Pick<typeof AuthDB, "select" | "insert" | "update"> = AuthDB,
) {
  const organizationId = input.organizationId.trim();
  const userId = input.userId.trim();
  const role = (input.role ?? "owner").trim() || "owner";

  await ensureAuthOrganization({ organizationId });

  const [existing] = await db.select()
    .from(member)
    .where(
      and(eq(member.organizationId, organizationId), eq(member.userId, userId)),
    )
    .limit(1);

  if (existing) {
    if (existing.role !== role && (role === "owner" || input.setRole)) {
      const [updated] = await db.update(member)
        .set({ role })
        .where(eq(member.id, existing.id))
        .returning();
      return updated ?? existing;
    }
    return existing;
  }

  const [created] = await db.insert(member)
    .values({
      id: randomUUID(),
      organizationId,
      userId,
      role,
      createdAt: new Date(),
    })
    .returning();
  return created!;
}

export async function findMemberByUser(
  organizationId: string,
  userId: string,
) {
  const [row] = await AuthDB.select()
    .from(member)
    .where(
      and(eq(member.organizationId, organizationId), eq(member.userId, userId)),
    )
    .limit(1);
  return row ?? null;
}
