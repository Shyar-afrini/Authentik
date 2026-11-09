"use client";

import { Alert, AlertDescription, Badge, Button } from "@hel/ui";
import { RefreshCw } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/ui";
import { useApi } from "@/lib/api";
import type { AuditRow } from "@/lib/types";

export default function AuditPage() {
  const log = useApi<AuditRow[]>("/api/nexus/audit?limit=1000");
  const rows = log.data ?? [];
  const actions = [...new Set(rows.map((r) => r.action))].sort();
  const types = [...new Set(rows.map((r) => r.resource_type))].sort();
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Security-relevant changes, newest first. Shows the latest 1000 entries."
        actions={<Button variant="outline" leadingIcon={RefreshCw} onClick={() => void log.reload()}>Refresh</Button>}
      />
      {log.error ? <Alert tone="error" className="mb-4"><AlertDescription>{log.error}</AlertDescription></Alert> : null}
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        loading={log.loading}
        searchText={(r) => `${r.action} ${r.resource_type} ${r.resource_id ?? ""} ${r.actor_email ?? ""} ${r.ip ?? ""}`}
        searchPlaceholder="Search action, actor, resource…"
        empty="No audit entries yet."
        defaultSort={{ id: "at", desc: true }}
        filters={[
          { id: "action", label: "Action", options: actions.map((a) => ({ value: a, label: a })), match: (r, v) => r.action === v },
          { id: "type", label: "Resource", options: types.map((t) => ({ value: t, label: t })), match: (r, v) => r.resource_type === v },
        ]}
        columns={[
          { id: "at", header: "When", sort: (r) => r.at, cell: (r) => <span className="whitespace-nowrap">{new Date(r.at).toLocaleString()}</span> },
          { id: "action", header: "Action", sort: (r) => r.action, cell: (r) => <Badge variant="secondary">{r.action}</Badge> },
          { id: "actor", header: "Actor", sort: (r) => r.actor_email ?? "", cell: (r) => <span className={`whitespace-nowrap ${r.actor_email ? "" : "text-fg-base-muted"}`}>{r.actor_email ?? "system"}</span> },
          { id: "resource", header: "Resource", sort: (r) => r.resource_type, cell: (r) => <><div>{r.resource_type}</div>{r.resource_id ? <div className="max-w-56 truncate font-mono text-xs text-fg-base-muted" title={r.resource_id}>{r.resource_id}</div> : null}</> },
          { id: "ip", header: "IP", cell: (r) => <span className="whitespace-nowrap">{r.ip ?? ""}</span> },
          { id: "diff", header: "Details", cell: (r) => (r.diff ? <code className="block max-w-72 truncate text-xs" title={JSON.stringify(r.diff)}>{JSON.stringify(r.diff)}</code> : null) },
        ]}
      />
    </>
  );
}
