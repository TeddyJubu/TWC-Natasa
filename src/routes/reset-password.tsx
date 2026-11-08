import * as React from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Badge, Button, Container, FormField, Heading, ImageTrail, Input, Section, Text } from "@/index";
import { getAuthClient } from "@/app/auth-client";

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

function ResetPassword() {
  const navigate = useNavigate();
  const [status, setStatus] = React.useState<Status>("checking");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Better Auth's emailed link checks the token, then lands here with ?token=… or ?error=INVALID_TOKEN.
  const [token, setToken] = React.useState<string | null>(null);
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const found = params.get("token");
    setToken(found);
    setStatus(params.has("error") ? "expired" : found ? "ready" : "invalid");
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    const { error } = await (await getAuthClient()).resetPassword({ newPassword: password, token: token ?? "" });
    setBusy(false);
    // Sessions are revoked on reset, so she signs in with the new password.
    if (!error) navigate({ to: "/auth" });
    else if (error.code === "INVALID_TOKEN") setStatus("expired");
    else setError(error.message ?? "We couldn’t save your password. Please try again.");
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
      <ImageTrail />
    </main>
  );
}
