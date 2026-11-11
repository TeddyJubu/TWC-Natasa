import * as React from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { cn } from "@/index";
import { getAuthClient } from "@/app/auth-client";
import { AuthFrame, authAlert, authCard, authH } from "@/app/auth-ui";
import { Icon } from "@/app/layout/twc";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a New Password — The Women’s Collective" },
      { name: "description", content: "Set a new password for your Women’s Collective member account." },
      { property: "og:title", content: "Choose a New Password — The Women’s Collective" },
      { property: "og:description", content: "Set a new password for your member account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      // A one-off page reached from an emailed link, never for search engines.
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

type Status = "checking" | "ready" | "invalid" | "expired";
const SAVE_FAILED = "We couldn’t save your password. Please try again.";

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
    else setError(error.code?.startsWith("PASSWORD_TOO") && error.message ? error.message : SAVE_FAILED); // the rule, or one safe line
  }

  const bad = status === "invalid" || status === "expired";
  return (
    <AuthFrame>
      <div className="twc-wrap flex justify-center">
        <div className={cn(authCard, "max-w-[480px]")}>
          <span className="twc-eyebrow">Account</span>
          <h1 className={cn(authH, "-mt-1.5")}>Choose a new password.</h1>
          {status === "checking" && <p role="status" className="text-sb-muted">Checking your reset link…</p>}
          {bad && (
            <>
              <p role="alert" className={authAlert}>
                {status === "expired"
                  ? "This reset link has expired or was already used."
                  : "This link isn’t valid for resetting a password. Open the newest link from your email, or ask for a fresh one."}
              </p>
              <Link to="/auth" search={{ mode: "forgot" }} className="twc-btn twc-btn--outline w-full">
                Request a new link <Icon name="arrow" className="twc-arrow" />
              </Link>
            </>
          )}
          {status === "ready" && (
            <>
              <p className="text-sb-muted">Set a new password for your member account.</p>
              <form onSubmit={submit} className="flex flex-col gap-[18px]">
                <div className="twc-field">
                  <label htmlFor="password">New password</label>
                  <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="twc-input"
                    aria-invalid={error ? true : undefined} aria-describedby={cn("password-hint", error && "password-error")} />
                  <span id="password-hint" className="twc-hint">At least 8 characters.</span>
                  {error && <p id="password-error" role="alert" className="twc-error">{error}</p>}
                </div>
                <button type="submit" disabled={busy} aria-busy={busy || undefined} className="twc-btn mt-1 w-full">
                  Save password <Icon name="arrow" className="twc-arrow" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </AuthFrame>
  );
}
