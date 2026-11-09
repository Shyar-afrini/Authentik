"use client";

import { useState } from "react";
import { Alert, AlertDescription, Badge, Button } from "@hel/ui";
import { RefreshCw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import type { SessionRow } from "@/lib/types";

export default function SessionsPage() {
  const sessions = useApi<SessionRow[]>("/api/nexus/sessions");
  const [revoking, setRevoking] = useState<SessionRow[] | null>(null);
  const rows = sessions.data ?? [];
  const orgs = [...new Set(rows.map((r) => r.organization).filter((o): o is string => Boolean(o)))].sort();

  async function revoke(list: SessionRow[]) {
    for (const s of list) await api(`/api/nexus/sessions/${s.id}`, { method: "DELETE" });
    await sessions.reload();
  }

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Signed-in sessions that have not expired. Revoking one signs that device out."
        actions={<Button variant="outline" leadingIcon={RefreshCw} onClick={() => void sessions.reload()}>Refresh</Button>}
      />
      {sessions.error ? <Alert tone="error" className="mb-4"><AlertDescription>{sessions.error}</AlertDescription></Alert> : null}
      <DataTable
        rows={rows}
        rowKey={(s) => s.id}
        loading={sessions.loading}
        searchText={(s) => `${s.email} ${s.name} ${s.ip ?? ""} ${s.user_agent ?? ""} ${s.organization ?? ""}`}
        searchPlaceholder="Search user, IP, device…"
        empty="No active sessions."
        defaultSort={{ id: "started", desc: true }}
        filters={[
          { id: "org", label: "Organization", options: orgs.map((o) => ({ value: o, label: o })), match: (s, v) => s.organization === v },
          { id: "imp", label: "Type", options: [{ value: "imp", label: "Impersonated" }, { value: "normal", label: "Normal" }], match: (s, v) => s.impersonated === (v === "imp") },
        ]}
        bulkActions={[{ label: "Revoke", destructive: true, run: (r) => setRevoking(r) }]}
        columns={[
          { id: "user", header: "User", sort: (s) => s.email.toLowerCase(), cell: (s) => <><div className="font-medium">{s.name}</div><div className="text-xs text-fg-base-muted">{s.email}</div></> },
          { id: "org", header: "Organization", sort: (s) => s.organization ?? "", cell: (s) => s.organization ?? <span className="text-fg-base-muted">none</span> },
          { id: "device", header: "Device", cell: (s) => <span className="block max-w-64 truncate" title={s.user_agent ?? ""}>{s.user_agent ?? ""}</span> },
          { id: "ip", header: "IP", cell: (s) => s.ip ?? "" },
          { id: "started", header: "Started", sort: (s) => s.created_at, cell: (s) => new Date(s.created_at).toLocaleString() },
          { id: "expires", header: "Expires", sort: (s) => s.expires_at, cell: (s) => <>{new Date(s.expires_at).toLocaleString()}{s.impersonated ? <> <Badge variant="warning">impersonated</Badge></> : null}</> },
        ]}
        rowActions={(s) => <Button size="sm" variant="ghost" intent="destructive" aria-label={`Revoke session of ${s.email}`} onClick={() => setRevoking([s])}><Trash2 className="size-4" /></Button>}
      />
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={revoking && revoking.length > 1 ? `Revoke ${revoking.length} sessions?` : "Revoke this session?"}
        description="The signed-in device is signed out the next time it contacts the server."
        confirmLabel="Revoke"
        onConfirm={() => revoke(revoking ?? [])}
      />
    </>
  );
}
