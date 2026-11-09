"use client";

import { useState, type ReactNode } from "react";
import { Button, FieldControl } from "@hel/ui";
import { Check, Copy } from "lucide-react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 pb-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg-base-primary">{title}</h1>
        {description ? <p className="mt-1 text-sm text-fg-base-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-fg-base-primary">{label}</span>
      {children}
      {hint ? <span className="text-xs text-fg-base-muted">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: React.ComponentProps<"input">) {
  return <FieldControl {...(props as object)} />;
}

/** Read-only value with a copy button (organization ids, env snippets). */
export function CopyValue({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md border bg-surface-base-subtle px-3 py-1.5 font-mono text-xs" title={value}>{value}</code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={label ?? "Copy"}
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}

export function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border bg-surface-base-subtle p-3 pe-14 font-mono text-xs leading-relaxed">{children}</pre>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="absolute end-2 top-2"
        aria-label="Copy snippet"
        onClick={() => {
          void navigator.clipboard.writeText(children).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}
