"use client";

import { createElement, Fragment, type ReactNode } from "react";
import type { Actions, Subjects } from "./ability.js";
import { useAbility } from "./use-can.js";

type GateNav = {
  items: { href?: string; ability?: { action: string; subject: string } }[];
}[];

/** Ability required by the nav entry whose href is the longest prefix of `path`. */
export function abilityForPath(nav: GateNav, path: string) {
  let best: { len: number; ability: { action: string; subject: string } } | null = null;
  for (const group of nav) {
    for (const item of group.items) {
      if (!item.href || !item.ability) continue;
      const href = item.href.replace(/\/$/, "");
      const hit = path === href || path.startsWith(`${href}/`);
      if (hit && (!best || href.length > best.len)) {
        best = { len: href.length, ability: item.ability };
      }
    }
  }
  return best?.ability;
}

function notPermitted() {
  return createElement(
    "main",
    { className: "mx-auto max-w-3xl p-8" },
    createElement("h1", { className: "text-xl font-semibold" }, "Not permitted"),
    createElement(
      "p",
      { className: "mt-2 text-muted-foreground" },
      "You do not have access to this page. Ask an administrator for the required permission.",
    ),
  );
}

/**
 * Page-level gate: hides a route whose nav entry requires an ability the user lacks.
 * Fails closed while the principal loads. The API still enforces `@RequireAbility`;
 * this only stops the UI from rendering screens the user cannot use.
 */
export function AbilityRouteGate({
  nav,
  path,
  children,
  fallback,
}: {
  nav: GateNav;
  path: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can, ready } = useAbility();
  const required = abilityForPath(nav, path);
  if (!required) return createElement(Fragment, null, children);
  if (!ready) return null;
  if (!can(required.action as Actions, required.subject as Subjects)) {
    return createElement(Fragment, null, fallback ?? notPermitted());
  }
  return createElement(Fragment, null, children);
}
