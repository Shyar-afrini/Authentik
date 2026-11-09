import "dotenv/config";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { createAuth } from "../better-auth/create-auth.js";
import { AuthDB } from "./index.js";
import { user } from "./schema/index.js";
import { ensureOrgMember } from "../organizations/org-bootstrap.js";

type SeedUserInput = {
  email: string;
  name: string;
  password: string;
  image?: string;
  role?: "admin" | "user";
};

function isAlreadyExistsError(error: unknown) {
  if (!(error instanceof APIError)) return false;
  if (error.statusCode === 422) return true;
  const body = error.body as { code?: string; message?: string } | undefined;
  return (
    body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
    body?.message?.toLowerCase().includes("already exists") === true
  );
}

const auth = createAuth({ nextCookies: false });

/** Create a user + credential account via Better Auth. */
export async function seedUserWithPassword(input: SeedUserInput) {
  try {
    const data = await auth.api.signUpEmail({
      body: {
        email: input.email,
        name: input.name,
        password: input.password,
        image: input.image,
      },
    });

    if (input.role === "admin") {
      // First admin: no existing admin session for auth.api.setRole — update directly.
      await AuthDB.update(user)
        .set({ role: "admin" })
        .where(eq(user.id, data.user.id));
    }

    return { user: data.user, created: true as const };
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      const [existing] = await AuthDB.select()
        .from(user)
        .where(eq(user.email, input.email))
        .limit(1);
      if (input.role === "admin" && existing) {
        await AuthDB.update(user)
          .set({ role: "admin" })
          .where(eq(user.id, existing.id));
      }
      return {
        user: existing ?? null,
        created: false as const,
        email: input.email,
      };
    }
    throw error;
  }
}

const seed = async () => {
  const result = await seedUserWithPassword({
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@authentik.local",
    name: process.env.SEED_ADMIN_NAME ?? "Authentik Admin",
    password: process.env.SEED_ADMIN_PASSWORD ?? "Admin123!",
    image: "https://avatars.githubusercontent.com/u/127545417?v=4",
    role: "admin",
  });

  const userId = result.user?.id;
  if (result.created) {
    console.log("Seeded admin", {
      userId,
      email: result.user?.email,
    });
  } else {
    console.log("User already exists, skipped", {
      email: result.email,
      userId,
    });
  }

  const organizationId =
    process.env.SEED_ORGANIZATION_ID?.trim() ||
    process.env.AUTHENTIK_ORGANIZATION_ID?.trim();

  if (userId && organizationId) {
    const membership = await ensureOrgMember({
      organizationId,
      userId,
      role: "owner",
    });
    console.log("Ensured admin org membership", {
      organizationId,
      memberId: membership.id,
      role: membership.role,
    });
  } else if (!organizationId) {
    console.log(
      "No SEED_ORGANIZATION_ID / AUTHENTIK_ORGANIZATION_ID — skipped org membership. Run after accounting install, or open Settings → Users (ensure org).",
    );
  }

  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
