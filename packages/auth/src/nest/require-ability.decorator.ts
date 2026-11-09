import { SetMetadata } from "@nestjs/common";
import type { Actions, Subjects } from "./ability.js";

export const REQUIRE_ABILITY_KEY = "nexus:requireAbility";

export type RequireAbilityMeta = {
  action: Actions;
  subject: Subjects;
};

export const RequireAbility = (action: Actions, subject: Subjects) =>
  SetMetadata(REQUIRE_ABILITY_KEY, { action, subject } satisfies RequireAbilityMeta);
