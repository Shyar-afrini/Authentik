"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@hel/ui";
import { Field, TextInput } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (result.error) return setError(result.error.message ?? "Sign-in failed");
    router.replace("/");
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Authentik</CardTitle>
          <CardDescription>Sign in to manage organizations and applications.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={(e) => void onSubmit(e)}>
            <Field label="Email">
              <TextInput type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy} />
            </Field>
            <Field label="Password">
              <TextInput type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={busy} />
            </Field>
            {error ? <Alert tone="error"><AlertDescription>{error}</AlertDescription></Alert> : null}
            <Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
