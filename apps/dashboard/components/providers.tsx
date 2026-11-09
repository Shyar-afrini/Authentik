"use client";

import type { ReactNode } from "react";
import { HelProvider } from "@hel/ui/provider";

export function Providers({ children }: { children: ReactNode }) {
  return <HelProvider toaster>{children}</HelProvider>;
}
