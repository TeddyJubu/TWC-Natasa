import * as React from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Badge, Button, Container, FormField, Heading, Input, Section, Text } from "@/index";
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

type Status = "checking" | "ready" | "invalid" | "expired";

/** True when the access token came from a password-recovery link (GoTrue stamps `amr: [{ method: "recovery" }]`). */
function isRecoverySession(session: { access_token?: string } | null | undefined) {
  try {
    const payload = session?.access_token?.split(".")[1];
    if (!payload) return false;
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return Array.isArray(claims.amr) && claims.amr.some((a: { method?: string } | string) => (typeof a === "string" ? a : a.method) === "recovery");
  } catch {
    return false;
  }
}

/** Supabase reports a failed or expired link as `#error=…` (implicit flow) or `?error=…` (PKCE). */
const linkError = () => /(?:^|[#?&])error(?:_code)?=/.test(window.location.hash + window.location.search);

function ResetPassword() {
  const navigate = useNavigate();
  const [status, setStatus] = React.useState<Status>("checking");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (linkError()) {
      setStatus("expired");
      return;
    }
    let active = true;
    // The PASSWORD_RECOVERY event can fire before this subscribes (auth-js emits it right after init),
    // so an existing recovery session counts too. Anything else is not a reset.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && active) setStatus("ready");
    });
    supabase.auth.getSession()
      .then(({ data: { session } }) => isRecoverySession(session), () => false)
      .then((recovery) => {
        if (active) setStatus((current) => (current === "ready" || recovery ? "ready" : "invalid"));
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (!error) navigate({ to: "/account" });
    else if (error.name === "AuthSessionMissingError") setStatus("expired");
    else setError(error.message);
  }

  return (
    <main id="main" tabIndex={-1} className="outline-none">
    <Section className="min-h-screen">
      <Container width="narrow" className="flex flex-col items-start gap-8">
        <Badge>Account</Badge>
        <Heading as="h1">Choose a New Password</Heading>
        {status === "checking" && <p role="status" className="text-sm text-ink-muted">Checking your reset link…</p>}
        {(status === "invalid" || status === "expired") && (
          <div role="alert" className="flex max-w-md flex-col items-start gap-4">
            <Text tone="muted">
              {status === "expired"
                ? "This reset link has expired or was already used."
                : "This link isn’t valid for resetting a password. Open the newest link from your email, or ask for a fresh one."}
            </Text>
            <Link to="/auth" search={{ mode: "forgot" }} className="text-sm underline underline-offset-4">Request a new link</Link>
          </div>
        )}
        {status === "ready" && (
          <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-8">
            <FormField label="New password" htmlFor="password" error={error ?? undefined}>
              <Input name="password" type="password" minLength={8} required autoComplete="new-password" />
            </FormField>
            <Button type="submit" variant="ink" state={busy ? "loading" : "idle"}>Save password</Button>
          </form>
        )}
      </Container>
    </Section>
    </main>
  );
}
