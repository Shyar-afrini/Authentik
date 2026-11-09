"use client";

import { use, useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@hel/ui";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm";
import { DataTable } from "@/components/data-table";
import { CodeBlock, CopyValue, Field, PageHeader, TextInput } from "@/components/ui";
import { api, errorMessage, useApi } from "@/lib/api";
import { CLIENT_TYPES, type AppRow, type OrgDetail, type OrgSettings } from "@/lib/types";

const ROLES = ["owner", "admin", "member"];

const PACKAGE_BY_TYPE: Record<string, string> = {
  nestjs: "pnpm add @authentik/auth   # AuthModule + AuthGuard (Nest)",
  nextjs: "pnpm add @authentik/auth   # @authentik/auth/next: createNextAuth + authentikAuthRewrites",
  "react-native": "pnpm add @authentik/auth-native @better-auth/expo expo-secure-store",
};

export default function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const org = useApi<OrgDetail>(`/api/nexus/orgs/${id}`);
  const apps = useApi<AppRow[]>("/api/nexus/apps");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [removing, setRemoving] = useState<OrgDetail["members"] | null>(null);
  const [form, setForm] = useState<{ twoFactor: boolean; maxAgeMinutes: string; minLength: string; origins: string } | null>(null);

  useEffect(() => {
    const s = org.data?.settings;
    if (s) {
      setForm({
        twoFactor: s.requireTwoFactor,
        maxAgeMinutes: s.sessionMaxAgeSeconds ? String(Math.round(s.sessionMaxAgeSeconds / 60)) : "",
        minLength: String(s.passwordMinLength),
        origins: s.allowedOrigins.join("\n"),
      });
    }
  }, [org.data?.settings]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await org.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const entitled = new Map((org.data?.apps ?? []).map((a) => [a.app, a.clientTypes]));
  const setApp = (app: string, clientTypes: string[]) => run(() => api(`/api/nexus/orgs/${id}/apps/${app}`, { method: "PUT", body: { clientTypes } }));

  async function saveSettings() {
    if (!form) return;
    await run(async () => {
      const minutes = form.maxAgeMinutes.trim();
      const body: Partial<OrgSettings> = {
        requireTwoFactor: form.twoFactor,
        sessionMaxAgeSeconds: minutes ? Number(minutes) * 60 : null,
        passwordMinLength: Number(form.minLength),
        allowedOrigins: form.origins.split(/\s+/).filter(Boolean),
      };
      await api(`/api/nexus/orgs/${id}/settings`, { method: "PUT", body });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  if (org.loading) return <Skeleton className="h-64 w-full" />;
  if (!org.data) return <Alert tone="error"><AlertDescription>{org.error ?? "Organization not found"}</AlertDescription></Alert>;

  const types = [...new Set([...entitled.values()].flat())];
  return (
    <>
      <PageHeader title={org.data.name} description="Applications, client types, security policy and members." />
      {error ? <Alert tone="error" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="members">Members <span className="text-fg-base-muted">{org.data.members.length}</span></TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Organization id</CardTitle>
            <CardDescription>Applications use this id to tell the auth server which organization a request is for.</CardDescription>
          </CardHeader>
          <CardContent><CopyValue value={org.data.id} label="Copy organization id" /></CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="applications" className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
            <CardDescription>Which systems this organization can reach, and how each connects.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(apps.data ?? []).map((a) => {
              const on = entitled.has(a.key);
              const current = entitled.get(a.key) ?? [];
              return (
                <div key={a.key} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div><span className="font-medium">{a.name}</span> <span className="text-xs text-fg-base-muted">{a.key}</span></div>
                    <Button size="sm" variant={on ? "outline" : "default"} intent={on ? "destructive" : undefined} disabled={busy} onClick={() => void (on ? run(() => api(`/api/nexus/orgs/${id}/apps/${a.key}`, { method: "DELETE" })) : setApp(a.key, []))}>
                      {on ? "Remove access" : "Grant access"}
                    </Button>
                  </div>
                  {on ? (
                    <div className="mt-2 flex flex-wrap gap-4 text-sm">
                      {CLIENT_TYPES.map((t) => (
                        <label key={t.id} className="flex items-center gap-1.5">
                          <input type="checkbox" disabled={busy} checked={current.includes(t.id)} onChange={() => void setApp(a.key, current.includes(t.id) ? current.filter((x) => x !== t.id) : [...current, t.id])} /> {t.label}
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {entitled.size ? (
          <Card>
            <CardHeader>
              <CardTitle>Connect a client</CardTitle>
              <CardDescription>Environment for each application server, plus the package for the selected client types.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <CodeBlock>{`AUTHENTIK_URL=<this auth server's public URL>\nAUTHENTIK_APP_KEY=<the application's key>\nAUTHENTIK_ORGANIZATION_ID=${org.data.id}`}</CodeBlock>
              {types.length ? <CodeBlock>{types.map((t) => PACKAGE_BY_TYPE[t]).join("\n")}</CodeBlock> : <p className="text-sm text-fg-base-muted">Pick client types above to see the packages to install.</p>}
            </CardContent>
          </Card>
        ) : null}
        </TabsContent>

        <TabsContent value="security" className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Security settings</CardTitle>
            <CardDescription>Enforced for this organization by the auth server.</CardDescription>
          </CardHeader>
          <CardContent>
            {form ? (
              <form className="grid max-w-xl gap-4" onSubmit={(e) => { e.preventDefault(); void saveSettings(); }}>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.twoFactor} onChange={(e) => setForm({ ...form, twoFactor: e.target.checked })} /> Require two-factor authentication</label>
                <Field label="Session lifetime (minutes)" hint="Empty follows the server default. 5 minutes to 365 days.">
                  <TextInput inputMode="numeric" value={form.maxAgeMinutes} onChange={(e) => setForm({ ...form, maxAgeMinutes: e.target.value })} />
                </Field>
                <Field label="Minimum password length" hint="8 to 128.">
                  <TextInput inputMode="numeric" value={form.minLength} onChange={(e) => setForm({ ...form, minLength: e.target.value })} />
                </Field>
                <Field label="Allowed application origins" hint="One per line, e.g. https://erp.example.com. Used for CORS and sign-in redirects.">
                  <textarea className="min-h-24 rounded-md border bg-surface-base-page p-2 font-mono text-xs" value={form.origins} onChange={(e) => setForm({ ...form, origins: e.target.value })} />
                </Field>
                <div className="flex items-center gap-3"><Button type="submit" loading={busy} loadingText="Saving…">Save settings</Button>{saved ? <span className="text-sm text-fg-status-success">Saved</span> : null}</div>
              </form>
            ) : null}
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="members" className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>People are created and given permissions inside each application (for Authentik, under Settings → Users).</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={org.data.members}
              rowKey={(m) => m.userId}
              searchText={(m) => `${m.name} ${m.email}`}
              searchPlaceholder="Search members…"
              empty="No members yet."
              defaultSort={{ id: "name" }}
              filters={[{ id: "role", label: "Role", options: ROLES.map((r) => ({ value: r, label: r })), match: (m, v) => m.role === v }]}
              bulkActions={[{ label: "Remove", destructive: true, run: (rows) => setRemoving(rows) }]}
              columns={[
                { id: "name", header: "Name", sort: (m) => m.name.toLowerCase(), cell: (m) => m.name },
                { id: "email", header: "Email", sort: (m) => m.email.toLowerCase(), cell: (m) => m.email },
                {
                  id: "role", header: "Role", sort: (m) => m.role,
                  cell: (m) => (
                    <select className="h-8 rounded-md border bg-surface-base-page px-2 text-sm" aria-label={`Role of ${m.email}`} value={m.role} disabled={busy} onChange={(e) => void run(() => api(`/api/nexus/orgs/${id}/members/${m.userId}`, { method: "PUT", body: { role: e.target.value } }))}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ),
                },
              ]}
              rowActions={(m) => <Button size="sm" variant="ghost" intent="destructive" aria-label={`Remove ${m.email}`} onClick={() => setRemoving([m])}><Trash2 className="size-4" /></Button>}
            />
            <ConfirmDialog
              open={removing !== null}
              onOpenChange={(o) => !o && setRemoving(null)}
              title={removing && removing.length > 1 ? `Remove ${removing.length} members?` : `Remove ${removing?.[0]?.email ?? "member"}?`}
              description="They lose access to this organization. Their accounts are kept."
              confirmLabel="Remove"
              onConfirm={async () => {
                for (const m of removing ?? []) await api(`/api/nexus/orgs/${id}/members/${m.userId}`, { method: "DELETE" });
                await org.reload();
              }}
            />
          </CardContent>
        </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
