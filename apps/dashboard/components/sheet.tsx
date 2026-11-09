"use client";

import type { FormEvent, ReactNode } from "react";
import { Button, Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@hel/ui";

/** A form in Hel's Drawer: title up top, fields scrolling in the middle, actions in the footer. */
export function Sheet({
  open, onOpenChange, title, description, children, onSubmit, busy = false, error = null, submitLabel = "Save", submitDisabled = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit: () => void | Promise<void>;
  busy?: boolean;
  error?: string | null;
  submitLabel?: string;
  submitDisabled?: boolean;
}) {
  function handle(e: FormEvent) {
    e.preventDefault();
    if (!busy && !submitDisabled) void onSubmit();
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange} side="right">
      <DrawerContent className="flex w-full flex-col sm:max-w-xl">
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handle}>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description ? <DrawerDescription>{description}</DrawerDescription> : null}
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">{children}</div>
          <DrawerFooter>
            {error ? <p role="alert" className="me-auto text-sm text-fg-status-error">{error}</p> : null}
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || submitDisabled}>{busy ? "Saving…" : submitLabel}</Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
