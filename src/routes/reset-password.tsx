import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Badge, Button, Container, FormField, Heading, Input, Section } from "@/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a New Password — The Women’s Collective" },
      { name: "description", content: "Set a new password for your Women’s Collective member account." },
      { property: "og:title", content: "Choose a New Password — The Women’s Collective" },
      { property: "og:description", content: "Set a new password for your member account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message); else navigate({ to: "/account" });
  }
  return (
    <Section className="min-h-screen">
      <Container width="narrow" className="flex flex-col items-start gap-8">
        <Badge>Account</Badge>
        <Heading as="h1">Choose a New Password</Heading>
        <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-8">
          <FormField label="New password" htmlFor="password" error={error ?? undefined}>
            <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" aria-invalid={!!error} aria-describedby={error ? "password-error" : undefined} />
          </FormField>
          <Button type="submit" variant="ink" state={busy ? "loading" : "idle"}>Save password</Button>
        </form>
      </Container>
    </Section>
  );
}
