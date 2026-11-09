"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Checkbox, SearchField, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@hel/ui";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Makes the column sortable by this value. */
  sort?: (row: T) => string | number;
  className?: string;
};

export type TableFilter<T> = {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  /** Whether the row passes when `value` is chosen. */
  match: (row: T, value: string) => boolean;
};

export type BulkAction<T> = {
  label: string;
  destructive?: boolean;
  run: (rows: T[]) => void | Promise<void>;
};

const PAGE_SIZES = [10, 25, 50, 100];

const selectClass = "h-9 rounded-md border bg-surface-base-page px-2.5 text-sm text-fg-base-primary";

/**
 * Searchable, sortable, filterable, paged table with optional row selection and bulk actions.
 * Everything runs on the rows it is given, which the server already caps.
 */
export function DataTable<T>({
  rows, columns, rowKey, loading = false, searchText, searchPlaceholder = "Search…", filters = [],
  bulkActions = [], rowActions, empty = "Nothing here yet.", defaultSort,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  /** Text a row is matched against by the search box. Omit to hide the box. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: TableFilter<T>[];
  /** Giving any makes rows selectable. */
  bulkActions?: BulkAction<T>[];
  rowActions?: (row: T) => ReactNode;
  empty?: string;
  defaultSort?: { id: string; desc?: boolean };
}) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [sort, setSort] = useState(defaultSort ?? null);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const selectable = bulkActions.length > 0;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows.filter((r) => (!q || !searchText || searchText(r).toLowerCase().includes(q)) && filters.every((f) => !chosen[f.id] || f.match(r, chosen[f.id])));
    const col = sort && columns.find((c) => c.id === sort.id);
    if (col?.sort) {
      const by = col.sort;
      const dir = sort?.desc ? -1 : 1;
      out = [...out].sort((a, b) => {
        const x = by(a), y = by(b);
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * dir;
      });
    }
    return out;
  }, [rows, query, chosen, sort, columns, filters, searchText]);

  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, pages - 1);
  const shown = visible.slice(current * pageSize, (current + 1) * pageSize);

  // Selection only ever holds rows that still exist (after a reload or delete).
  useEffect(() => {
    const keys = new Set(rows.map(rowKey));
    setSelected((s) => (s.size && [...s].some((k) => !keys.has(k)) ? new Set([...s].filter((k) => keys.has(k))) : s));
  }, [rows, rowKey]);
  useEffect(() => setPage(0), [query, chosen, pageSize]);

  const shownKeys = shown.map(rowKey);
  const allShown = shownKeys.length > 0 && shownKeys.every((k) => selected.has(k));
  const someShown = shownKeys.some((k) => selected.has(k));
  const toggleShown = () => setSelected((s) => {
    const next = new Set(s);
    for (const k of shownKeys) allShown ? next.delete(k) : next.add(k);
    return next;
  });
  const toggle = (k: string) => setSelected((s) => {
    const next = new Set(s);
    next.has(k) ? next.delete(k) : next.add(k);
    return next;
  });
  const sortBy = (id: string) => setSort((s) => (s?.id === id ? (s.desc ? null : { id, desc: true }) : { id }));

  async function runBulk(action: BulkAction<T>) {
    setBusy(true);
    try {
      await action.run(rows.filter((r) => selected.has(rowKey(r))));
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  const colSpan = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);
  const hasToolbar = searchText || filters.length > 0;
  return (
    <div className="flex flex-col gap-3">
      {hasToolbar ? (
        <div className="flex flex-wrap items-center gap-2 [&>*]:h-9">
          {searchText ? <SearchField className="h-9 w-full sm:w-72" value={query} onValueChange={setQuery} placeholder={searchPlaceholder} aria-label="Search" /> : null}
          {filters.map((f) => (
            <select key={f.id} className={selectClass} aria-label={f.label} value={chosen[f.id] ?? ""} onChange={(e) => setChosen((c) => ({ ...c, [f.id]: e.target.value }))}>
              <option value="">{f.label}: all</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
        </div>
      ) : null}

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-surface-base-subtle px-3 py-2 text-sm">
          <span className="me-auto font-medium">{selected.size} selected</span>
          {bulkActions.map((a) => (
            <Button key={a.label} size="sm" variant="outline" intent={a.destructive ? "destructive" : undefined} disabled={busy} onClick={() => void runBulk(a)}>{a.label}</Button>
          ))}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      ) : null}

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {selectable ? <TableHead className="w-10"><Checkbox aria-label="Select all on this page" checked={allShown} indeterminate={!allShown && someShown} onCheckedChange={toggleShown} /></TableHead> : null}
              {columns.map((c) => (
                <TableHead key={c.id} className={c.className} aria-sort={sort?.id === c.id ? (sort.desc ? "descending" : "ascending") : undefined}>
                  {c.sort ? (
                    <button type="button" className="inline-flex items-center gap-1 font-medium hover:underline" onClick={() => sortBy(c.id)}>
                      {c.header}
                      {sort?.id === c.id ? (sort.desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />) : <ChevronsUpDown className="size-3.5 opacity-50" />}
                    </button>
                  ) : c.header}
                </TableHead>
              ))}
              {rowActions ? <TableHead className="w-24 text-end"><span className="sr-only">Actions</span></TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow><TableCell colSpan={colSpan} className="py-8 text-center text-fg-base-muted">{rows.length ? "No results match your search or filters." : empty}</TableCell></TableRow>
            ) : shown.map((r) => {
              const k = rowKey(r);
              return (
                <TableRow key={k} data-state={selected.has(k) ? "selected" : undefined}>
                  {selectable ? <TableCell><Checkbox aria-label="Select row" checked={selected.has(k)} onCheckedChange={() => toggle(k)} /></TableCell> : null}
                  {columns.map((c) => <TableCell key={c.id} className={c.className}>{c.cell(r)}</TableCell>)}
                  {rowActions ? <TableCell className="text-end"><div className="flex justify-end gap-1">{rowActions(r)}</div></TableCell> : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {!loading && visible.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-fg-base-muted">
          <span>
            {visible.length === rows.length ? `${rows.length} total` : `${visible.length} of ${rows.length}`} · page {current + 1} of {pages}
          </span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5">Rows
              <select className={selectClass} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <Button size="sm" variant="outline" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft className="size-4" /></Button>
            <Button size="sm" variant="outline" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}><ChevronRight className="size-4" /></Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
