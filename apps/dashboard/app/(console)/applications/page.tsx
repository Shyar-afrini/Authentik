"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, Badge, Button } from "@hel/ui";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm";
import { DataTable } from "@/components/data-table";
import { Sheet } from "@/components/sheet";
import { Field, PageHeader, TextInput } from "@/components/ui";
import { api, errorMessage, useApi } from "@/lib/api";
import type { AppRow } from "@/lib/types";

export default function ApplicationsPage() {
  const apps = useApi<AppRow[]>("/api/nexus/apps");
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<AppRow[] | null>(null);

  async function remove(list: AppRow[]) {
    for (const a of list) await api(`/api/nexus/apps/${encodeURIComponent(a.key)}`, { method: "DELETE" });
    await apps.reload();
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      // An application starts with an empty vocabulary; it publishes its own with its key.
      await api(`/api/nexus/apps/${encodeURIComponent(key)}/registry`, { method: "PUT", body: { name, subjects: [], roles: [] } });
      window.location.href = `/applications/${key}`;
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Applications"
        description="Systems that trust this server. Each has one key and publishes its own permissions."
        actions={<Button leadingIcon={Plus} onClick={() => setOpen(true)}>New application</Button>}
      />
      {apps.error ? <Alert tone="error"><AlertDescription>{apps.error}</AlertDescription></Alert> : null}
      <DataTable
        rows={apps.data ?? []}
        rowKey={(a) => a.key}
        loading={apps.loading}
        searchText={(a) => `${a.name} ${a.key}`}
        searchPlaceholder="Search applications…"
        empty="No applications yet."
        defaultSort={{ id: "name" }}
        filters={[{ id: "key", label: "Key", options: [{ value: "active", label: "Active" }, { value: "none", label: "No key" }], match: (a, v) => (v === "active") === Boolean(a.key_hint) }]}
        bulkActions={[{ label: "Delete", destructive: true, run: (rows) => setDeleting(rows) }]}
        columns={[
          { id: "name", header: "Application", sort: (a) => a.name.toLowerCase(), cell: (a) => <><Link className="font-medium underline-offset-2 hover:underline" href={`/applications/${a.key}`}>{a.name}</Link><div className="text-xs text-fg-base-muted">{a.key}</div></> },
          { id: "key", header: "Key", sort: (a) => (a.key_hint ? 1 : 0), cell: (a) => (a.key_hint ? <Badge variant="success">active …{a.key_hint}</Badge> : <Badge variant="warning">no key</Badge>) },
          { id: "orgs", header: "Organizations", sort: (a) => a.organizations, cell: (a) => a.organizations },
          { id: "subjects", header: "Permission subjects", sort: (a) => a.subjects, cell: (a) => a.subjects },
        ]}
        rowActions={(a) => <Button size="sm" variant="ghost" intent="destructive" aria-label={`Delete ${a.name}`} onClick={() => setDeleting([a])}><Trash2 className="size-4" /></Button>}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting && deleting.length > 1 ? `Delete ${deleting.length} applications?` : `Delete ${deleting?.[0]?.name ?? "application"}?`}
        description="Its key stops working at once, and its permission vocabulary and organization access are removed. This cannot be undone."
        onConfirm={() => remove(deleting ?? [])}
      />

      <Sheet open={open} onOpenChange={setOpen} title="New application" description="Register a system, then issue its key and connect organizations to it." onSubmit={create} busy={busy} error={error} submitLabel="Create" submitDisabled={!/^[a-z][a-z0-9-]{1,39}$/.test(key) || !name.trim()}>
        <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus /></Field>
        <Field label="Key" hint="Lowercase id used in URLs and tokens, e.g. billing. Cannot change later."><TextInput value={key} onChange={(e) => setKey(e.target.value)} maxLength={40} /></Field>
      </Sheet>
    </>
  );
}
