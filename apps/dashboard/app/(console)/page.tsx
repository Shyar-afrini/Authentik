"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@hel/ui";
import { PageHeader } from "@/components/ui";
import { useApi } from "@/lib/api";
import type { AppRow, OrgRow } from "@/lib/types";

export default function OverviewPage() {
  const orgs = useApi<OrgRow[]>("/api/nexus/orgs");
  const apps = useApi<AppRow[]>("/api/nexus/apps");
  const tiles = [
    { href: "/organizations", title: "Organizations", value: orgs.data?.length, text: "Each organization has its own applications, members and security settings." },
    { href: "/applications", title: "Applications", value: apps.data?.length, text: "Systems that sign users in through this server, each with its own key." },
  ];
  return (
    <>
      <PageHeader title="Overview" description="Everything that connects to this auth server." />
      <div className="grid gap-4 md:grid-cols-2">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card className="h-full transition-colors hover:bg-surface-base-subtle">
              <CardHeader>
                <CardTitle>{t.title}</CardTitle>
                <CardDescription>{t.text}</CardDescription>
              </CardHeader>
              <CardContent>
                {t.value === undefined ? <Skeleton className="h-9 w-16" /> : <span className="text-3xl font-semibold">{t.value}</span>}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
