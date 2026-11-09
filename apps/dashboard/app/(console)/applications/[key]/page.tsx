"use client";

import { use, useState } from "react";
import { Alert, AlertDescription, AlertTitle, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@hel/ui";
import { CodeBlock, CopyValue, PageHeader } from "@/components/ui";
import { api, errorMessage, useApi } from "@/lib/api";

type KeyInfo = { active: boolean; hint?: string | null; createdAt?: string | null; lastUsedAt?: string | null };
type Registry = { key: string; name: string; audience: string | null; subjects: { subject: string; action: string }[]; roles: { key: string }[] };

export default function ApplicationPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const base = `/api/nexus/apps/${encodeURIComponent(key)}`;
  const registry = useApi<Registry>(`${base}/registry`);
  const keyInfo = useApi<KeyInfo>(`${base}/key`);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await keyInfo.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const subjects = new Set((registry.data?.subjects ?? []).map((s) => s.subject));
  const authUrl = process.env.NEXT_PUBLIC_AUTHENTIK_URL ?? "<this auth server's public URL>";

  return (
    <>
      <PageHeader title={registry.data?.name ?? key} description={`Application id: ${key}`} />
      {error || registry.error ? <Alert tone="error" className="mb-4"><AlertDescription>{error ?? registry.error}</AlertDescription></Alert> : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Application key</CardTitle>
            <CardDescription>The application presents this in the <code>x-authentik-app-key</code> header. Only a hash is stored, so it cannot be shown again.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {keyInfo.loading ? <Skeleton className="h-8 w-48" /> : keyInfo.data?.active ? <div className="flex items-center gap-2"><Badge variant="success">Active</Badge><span className="text-sm text-fg-base-muted">ends in …{keyInfo.data.hint}{keyInfo.data.lastUsedAt ? ` · last used ${new Date(keyInfo.data.lastUsedAt).toLocaleString()}` : " · never used"}</span></div> : <div><Badge variant="warning">No key issued</Badge></div>}
            {secret ? (
              <Alert tone="warning">
                <AlertTitle>Copy this key now</AlertTitle>
                <AlertDescription><CopyValue value={secret} label="Copy key" /></AlertDescription>
              </Alert>
            ) : null}
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => void run(async () => setSecret((await api<{ key: string }>(`${base}/key`, { method: "POST" })).key))}>
                {keyInfo.data?.active ? "Rotate key" : "Issue key"}
              </Button>
              {keyInfo.data?.active ? (
                <Button variant="outline" intent="destructive" disabled={busy} onClick={() => { if (confirm("Revoke the key? The application stops working until a new key is issued.")) void run(async () => { await api(`${base}/key`, { method: "DELETE" }); setSecret(null); }); }}>Revoke</Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connect it</CardTitle>
            <CardDescription>Set these in the application. The organization id comes from the organization&apos;s page.</CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock>{`AUTHENTIK_URL=${authUrl}\nAUTHENTIK_APP_KEY=${secret ?? "<the key above>"}\nAUTHENTIK_ORGANIZATION_ID=<organization id>`}</CodeBlock>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permission vocabulary</CardTitle>
            <CardDescription>Published by the application itself with its key; read-only here.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {registry.loading ? <Skeleton className="h-6 w-40" /> : <>{subjects.size} subjects · {registry.data?.roles.length ?? 0} role templates</>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
