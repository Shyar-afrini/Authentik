"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, Badge, Button } from "@hel/ui";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm";
import { DataTable } from "@/components/data-table";
import { Sheet } from "@/components/sheet";
import { Field, PageHeader, TextInput } from "@/components/ui";
import { api, errorMessage, useApi } from "@/lib/api";
import { CLIENT_TYPES, type AppRow, type OrgRow } from "@/lib/types";

export default function OrganizationsPage() {
  const orgs = useApi<OrgRow[]>("/api/nexus/orgs");
  const apps = useApi<AppRow[]>("/api/nexus/apps");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<OrgRow | null>(null);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<OrgRow[] | null>(null);

  async function rename() {
    if (!renaming) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/nexus/orgs/${renaming.id}`, { method: "PATCH", body: { name: newName } });
      setRenaming(null);
      await orgs.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(list: OrgRow[]) {
    for (const o of list) await api(`/api/nexus/orgs/${o.id}`, { method: "DELETE" });
    await orgs.reload();
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: string }>("/api/nexus/orgs", {
        method: "POST",
        body: { name, apps: Object.entries(picked).map(([app, clientTypes]) => ({ app, clientTypes })) },
      });
      window.location.href = `/organizations/${created.id}`;
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  const toggleApp = (key: string) =>
    setPicked((p) => {
      const { [key]: on, ...rest } = p;
      return on ? rest : { ...rest, [key]: [] };
    });
  const toggleType = (key: string, type: string) =>
    setPicked((p) => ({ ...p, [key]: p[key]?.includes(type) ? p[key].filter((t) => t !== type) : [...(p[key] ?? []), type] }));

  return (
    <>
      <PageHeader
        title="Organizations"
        description="Each organization is a client with its own members, applications and policy."
        actions={<Button leadingIcon={Plus} onClick={() => setOpen(true)}>New organization</Button>}
      />
      {orgs.error ? <Alert tone="error"><AlertDescription>{orgs.error}</AlertDescription></Alert> : null}
      <DataTable
        rows={orgs.data ?? []}
        rowKey={(o) => o.id}
        loading={orgs.loading}
        searchText={(o) => `${o.name} ${o.slug} ${o.apps.join(" ")}`}
        searchPlaceholder="Search organizations…"
        empty="No organizations yet."
        defaultSort={{ id: "created", desc: true }}
        filters={[
          { id: "app", label: "Application", options: (apps.data ?? []).map((a) => ({ value: a.key, label: a.name })), match: (o, v) => o.apps.includes(v) },
          { id: "members", label: "Members", options: [{ value: "none", label: "No members" }, { value: "some", label: "Has members" }], match: (o, v) => (v === "none" ? o.members === 0 : o.members > 0) },
        ]}
        bulkActions={[{ label: "Delete", destructive: true, run: (rows) => setDeleting(rows) }]}
        columns={[
          { id: "name", header: "Name", sort: (o) => o.name.toLowerCase(), cell: (o) => <><Link className="font-medium underline-offset-2 hover:underline" href={`/organizations/${o.id}`}>{o.name}</Link><div className="text-xs text-fg-base-muted">{o.slug}</div></> },
          { id: "apps", header: "Applications", sort: (o) => o.apps.length, cell: (o) => <div className="flex flex-wrap gap-1">{o.apps.length ? o.apps.map((a) => <Badge key={a} variant="secondary">{a}</Badge>) : <span className="text-fg-base-muted">none</span>}</div> },
          { id: "members", header: "Members", sort: (o) => o.members, cell: (o) => o.members },
          { id: "created", header: "Created", sort: (o) => o.created_at, cell: (o) => new Date(o.created_at).toLocaleDateString() },
        ]}
        rowActions={(o) => (
          <>
            <Button size="sm" variant="ghost" aria-label={`Rename ${o.name}`} onClick={() => { setNewName(o.name); setError(null); setRenaming(o); }}><Pencil className="size-4" /></Button>
            <Button size="sm" variant="ghost" intent="destructive" aria-label={`Delete ${o.name}`} onClick={() => setDeleting([o])}><Trash2 className="size-4" /></Button>
          </>
        )}
      />

      <Sheet open={renaming !== null} onOpenChange={(o) => !o && setRenaming(null)} title="Rename organization" onSubmit={rename} busy={busy} error={error} submitDisabled={!newName.trim()}>
        <Field label="Name"><TextInput value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120} autoFocus /></Field>
      </Sheet>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting && deleting.length > 1 ? `Delete ${deleting.length} organizations?` : `Delete ${deleting?.[0]?.name ?? "organization"}?`}
        description="Its members, application access and security settings are removed. People's accounts are kept. This cannot be undone."
        onConfirm={() => remove(deleting ?? [])}
      />

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="New organization"
        description="Choose which applications it may use and how each one connects. You get the organization id to configure them."
        onSubmit={create}
        busy={busy}
        error={error}
        submitLabel="Create"
        submitDisabled={!name.trim()}
      >
        <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus /></Field>
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium">Applications and client types</span>
          {(apps.data ?? []).map((a) => (
            <div key={a.key} className="rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={a.key in picked} onChange={() => toggleApp(a.key)} /> {a.name} <span className="text-fg-base-muted">({a.key})</span>
              </label>
              {a.key in picked ? (
                <div className="mt-2 flex flex-wrap gap-4 ps-6 text-sm">
                  {CLIENT_TYPES.map((t) => (
                    <label key={t.id} className="flex items-center gap-1.5">
                      <input type="checkbox" checked={picked[a.key]?.includes(t.id) ?? false} onChange={() => toggleType(a.key, t.id)} /> {t.label}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
}
