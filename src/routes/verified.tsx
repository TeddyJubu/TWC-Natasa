import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ConstellationLogo, cn } from "@/index";
import { getAuthClient } from "@/app/auth-client";
import { AuthFrame, authAlert, authCard, authH, authScript, slink } from "@/app/auth-ui";
import { Icon } from "@/app/layout/twc";

// Where every email-confirmation link lands (auth.server.ts sets the link's callbackURL). Better Auth verifies the
// token, signs her in and redirects here; a bad link comes back with ?error=TOKEN_EXPIRED|INVALID_TOKEN|….
export const Route = createFileRoute("/verified")({
  validateSearch: (search: Record<string, unknown>): { error?: string } =>
    typeof search.error === "string" && search.error ? { error: search.error } : {},
  head: () => ({
    meta: [
      { title: "Email Confirmed — The Women’s Collective" },
      { name: "description", content: "Confirm the email address for your Women’s Collective member account." },
      { property: "og:title", content: "Email Confirmed — The Women’s Collective" },
      { property: "og:description", content: "Confirm the email address for your member account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Verified,
});

// Same words as sign-up: a resend never tells anyone whether an account exists.
const RESENT = "If this email is new to us, a confirmation link is on its way.";

function Verified() {
  const { error } = Route.useSearch();
  return (
    <AuthFrame>
      <div className="twc-wrap flex justify-center">
        <div className="w-full max-w-[480px]">{error ? <Resend /> : <Confirmed />}</div>
      </div>
    </AuthFrame>
  );
}

function Confirmed() {
  // Better Auth signed her in on the way here; /account sends anyone without a session to sign in.
  return (
    <div className={cn(authCard, "items-center text-center")}>
      <span aria-hidden className="grid size-20 place-items-center rounded-full bg-sb-sun">
        <ConstellationLogo variant="ink" alt="" className="w-11" />
      </span>
      <div className="flex flex-col items-center gap-2.5">
        <p className={cn(authScript, "inline-flex items-center gap-2")}>email verified <Icon name="sparkle" className="size-6" /></p>
        <h1 className={authH}>You’re confirmed, neighbor.</h1>
      </div>
      <p className="text-sb-muted">Your email is verified. Finish your profile now so it’s ready the day you’re welcomed in.</p>
      <Link to="/account" className="twc-btn mt-1 w-full">Finish my profile <Icon name="arrow" className="twc-arrow" /></Link>
      <Link to="/join" className={slink}>Haven’t applied yet? Start your application</Link>
    </div>
  );
}

function Resend() {
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    setBusy(true); setSent(false); setFailed(false);
    const { error } = await (await getAuthClient()).sendVerificationEmail({ email, callbackURL: "/verified" });
    setBusy(false);
    // Rate limits are per address, so reporting one would confirm the account exists.
    if (!error || error.status === 429) setSent(true);
    else setFailed(true);
  }

  return (
    <div className={authCard}>
      <h1 className={authH}>This link has run its course.</h1>
      <p className="text-sb-muted">Confirmation links only work once and expire after a while. Pop in your email and we’ll send a fresh one.</p>
      <form onSubmit={submit} className="flex flex-col gap-[18px]">
        <div className="twc-field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="twc-input" aria-describedby={failed ? "resend-error" : undefined} />
        </div>
        {failed && <p id="resend-error" role="alert" className={authAlert}>We couldn’t send a link right now. Please try again in a minute.</p>}
        {sent && <p role="status" className="twc-notice twc-notice--mint text-[15px]">{RESENT}</p>}
        <button type="submit" disabled={busy} aria-busy={busy || undefined} className="twc-btn mt-1 w-full">
          Send a new link <Icon name="arrow" className="twc-arrow" />
        </button>
      </form>
      <p className="text-center"><Link to="/auth" className={slink}>Already confirmed? Sign in</Link></p>
    </div>
  );
}
