export type OrgRow = { id: string; name: string; slug: string; created_at: string; apps: string[]; members: number };
export type AppRow = { key: string; name: string; audience: string | null; key_hint: string | null; organizations: number; subjects: number };
export type OrgSettings = { requireTwoFactor: boolean; sessionMaxAgeSeconds: number | null; passwordMinLength: number; allowedOrigins: string[] };
export type OrgDetail = {
  id: string;
  name: string;
  slug: string;
  apps: { app: string; clientTypes: string[] }[];
  settings: OrgSettings;
  members: { memberId: string; userId: string; role: string; email: string; name: string }[];
};
export const CLIENT_TYPES = [
  { id: "nestjs", label: "NestJS API" },
  { id: "nextjs", label: "Next.js app" },
  { id: "react-native", label: "React Native app" },
] as const;
export type AuditRow = {
  id: string;
  at: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  organization_id: string | null;
  actor_email: string | null;
  ip: string | null;
  diff: unknown;
};
export type SessionRow = {
  id: string;
  email: string;
  name: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
  organization: string | null;
  impersonated: boolean;
};
