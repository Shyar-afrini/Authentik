import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata = {
  title: "Authentik",
  description: "Organizations, applications and access for every Authentik system",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-surface-base-page font-sans text-fg-base-primary antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
