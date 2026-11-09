"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Alert, AlertDescription, Button, Spinner } from "@hel/ui";
import { Building2, KeyRound, LayoutDashboard, LogOut, MonitorSmartphone, ScrollText } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const NAV = [
  { href: "/", label: "Overview", Icon: LayoutDashboard },
  { href: "/organizations", label: "Organizations", Icon: Building2 },
  { href: "/applications", label: "Applications", Icon: KeyRound },
  { href: "/sessions", label: "Sessions", Icon: MonitorSmartphone },
  { href: "/audit", label: "Audit log", Icon: ScrollText },
];

/** Signed-in, platform-admin-only frame around every console page. */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user as { name?: string; email?: string; role?: string | null } | undefined;

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  if (isPending || !session) {
    return <div className="flex min-h-svh items-center justify-center"><Spinner /></div>;
  }
  if (user?.role !== "admin") {
    return (
      <div className="mx-auto max-w-md p-8">
        <Alert tone="error">
          <AlertDescription>This dashboard is for platform administrators. Ask an administrator to grant your account access.</AlertDescription>
        </Alert>
        <Button className="mt-4" variant="outline" onClick={() => void authClient.signOut().then(() => router.replace("/login"))}>Sign out</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-start">
      <aside className="sticky top-0 flex h-svh w-60 shrink-0 flex-col border-e bg-surface-base-subtle">
        <div className="px-5 py-4 text-lg font-semibold">Authentik</div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {NAV.map(({ href, label, Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${active ? "bg-surface-base-page font-medium shadow-sm" : "text-fg-base-muted hover:bg-surface-base-page"}`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 border-t p-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user?.name}</div>
            <div className="truncate text-xs text-fg-base-muted">{user?.email}</div>
          </div>
          <Button variant="ghost" size="sm" aria-label="Sign out" onClick={() => void authClient.signOut().then(() => router.replace("/login"))}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1"><div className="mx-auto w-full max-w-6xl px-8 py-8">{children}</div></main>
    </div>
  );
}
