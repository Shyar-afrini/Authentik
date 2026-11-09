import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "nexus:isPublic";

/** Skip AuthGuard (and CaslGuard ability checks still need auth unless also public). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
