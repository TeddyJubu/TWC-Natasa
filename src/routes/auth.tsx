import * as React from "react";
import { Tabs, TabsList, TabsTab } from "@ui-sdk/react/tabs";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { cn } from "@/index";
import { getAuthClient } from "@/app/auth-client";
import { emitAuthEvent } from "@/app/auth-events";
import { AuthFrame, authAlert, authCard, authEyebrow, authH, slink } from "@/app/auth-ui";

type Mode = "signin" | "signup" | "forgot";
const MODES: readonly string[] = ["signin", "signup", "forgot"];

export const Route = createFileRoute("/auth")({
  // `/auth?mode=signup` opens Create account and `/auth?mode=forgot` the reset form (e.g. from an expired link);
  // `/auth?reset=done` is where a successful password reset lands, to say so above the sign-in form.
  validateSearch: (search: Record<string, unknown>): { mode?: Mode; reset?: "done" } => ({
    ...(typeof search.mode === "string" && MODES.includes(search.mode) ? { mode: search.mode as Mode } : {}),
    ...(search.reset === "done" ? { reset: "done" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Member Sign In — The Women’s Collective" },
      { name: "description", content: "Sign in or create your account to manage your Women’s Collective member profile." },
      { property: "og:title", content: "Member Sign In — The Women’s Collective" },
      { property: "og:description", content: "Your profile, events, and introductions in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

// One message for every sign-in failure, so the form never reveals which emails have accounts.
const SIGN_IN_FAILED = "That email or password didn’t match. Try again, or reset your password.";
// New and existing emails get the same sign-up notice, so the form can't be used to probe for accounts.
const SIGNUP_SENT = "Check your inbox: if this email is new to us, a confirmation link is on its way. Once confirmed, sign in to finish your profile. Already have an account? Sign in, or reset your password.";
const RESET_SENT = "If that email belongs to a member, a reset link is on its way.";
const PASSWORD_CHANGED = "Your password is changed. Sign in with your new one.";
const ALREADY_EXISTS = ["USER_ALREADY_EXISTS", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"];
const PASSWORD_RULES = ["PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG"];

const COPY: Record<Mode, { script: string; title: string; lede: string; submit: string }> = {
  signin: { script: "Members", title: "Log in to your constellation", lede: "", submit: "Log in" }, // the canvas's login()
  signup: { script: "hello, neighbor", title: "Open your member account", lede: "Create your login now; your profile unlocks once the collective approves your application.", submit: "Create account" },
  forgot: { script: "it happens", title: "Reset your password", lede: "We’ll send a link to choose a new password.", submit: "Send reset link" },
};
const TABS = [["signin", "Log in"], ["signup", "Create account"]] as const;

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setModeState] = React.useState<Mode>(search.mode ?? "signin");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{ title: string; text: string } | null>(
    search.reset === "done" && (search.mode ?? "signin") === "signin" ? { title: "Password changed", text: PASSWORD_CHANGED } : null,
  );
  const sent = (text: string) => setNotice({ title: "Almost there", text });
  const setMode = (next: Mode) => {
    setModeState(next);
    setError(null);
    setNotice(null);
  };
  // Forgot password? and Back to sign in unmount themselves: hand focus to the Email field so keyboard and screen-reader users keep their place.
  const switchTo = (next: Mode) => {
    setMode(next);
    requestAnimationFrame(() => document.getElementById("email")?.focus());
  };

  // Already signed in (e.g. back from Google, or a second visit): straight to the account.
  React.useEffect(() => {
    let active = true;
    void getAuthClient()
      .then((auth) => auth.getSession())
      .then(({ data }) => { if (active && data) navigate({ to: "/account" }); }, () => {});
    return () => { active = false; };
  }, [navigate]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "");
    const password = String(f.get("password") ?? "");
    setBusy(true); setError(null); setNotice(null);
    const auth = await getAuthClient();
    if (mode === "signin") {
      const { error } = await auth.signIn.email({ email, password });
      if (error) setError(SIGN_IN_FAILED);
      else {
        emitAuthEvent("SIGNED_IN");
        navigate({ to: "/account" });
      }
    } else if (mode === "signup") {
      // The emailed link lands on /verified whatever this says (auth.server.ts); kept in step for clarity.
      const { error } = await auth.signUp.email({ email, password, name: String(f.get("name") ?? ""), callbackURL: "/verified" });
      // An existing email gets the same notice as a new one: no account disclosure.
      if (!error || ALREADY_EXISTS.includes(error.code ?? "")) sent(SIGNUP_SENT);
      else if (PASSWORD_RULES.includes(error.code ?? "")) setError(error.message ?? "Please choose a password of 8 to 128 characters."); // the password rule, nothing about the email
      else setError("We couldn’t create your account right now. Please try again in a minute.");
    } else {
      const { error } = await auth.requestPasswordReset({ email, redirectTo: "/reset-password" });
      // Rate limits are per address, so reporting one would confirm the account exists.
      if (!error || error.status === 429) sent(RESET_SENT);
      else setError("We couldn’t send a link right now. Please try again in a minute.");
    }
    setBusy(false);
  }

  async function google() {
    setError(null);
    const { error } = await (await getAuthClient()).signIn.social({ provider: "google", callbackURL: "/account", errorCallbackURL: "/auth" });
    if (error) setError("Google sign-in didn’t work. Please try again.");
  }

  const copy = COPY[mode];
  const showTabs = mode !== "forgot";
  const errorId = error ? "auth-error" : undefined;
  const field = (id: string, label: string, input: React.InputHTMLAttributes<HTMLInputElement>, extra?: React.ReactNode, hint?: string) => (
    <div className="twc-field">
      {extra ? <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><label htmlFor={id} className="twc-label">{label}</label>{extra}</div> : <label htmlFor={id}>{label}</label>}
      <input id={id} name={id} required className="twc-input" aria-invalid={error ? true : undefined}
        aria-describedby={[hint && `${id}-hint`, errorId].filter(Boolean).join(" ") || undefined} {...input} />
      {hint && <span id={`${id}-hint`} className="twc-hint">{hint}</span>}
    </div>
  );

  return (
    <AuthFrame>
      <div className={authCard}>
        {showTabs && (
          <Tabs value={mode} onValueChange={(next) => { if (next) setMode(next as typeof mode); }}>
            <TabsList aria-label="Log in or create an account" className="flex gap-2">
              {TABS.map(([m, label]) => (
                <TabsTab key={m} value={m} id={`tab-${m}`} aria-controls="auth-panel" className="twc-ftab">
                  {label}
                </TabsTab>
              ))}
            </TabsList>
          </Tabs>
        )}

        <div id="auth-panel" role={showTabs ? "tabpanel" : undefined} aria-labelledby={showTabs ? `tab-${mode}` : undefined} className="flex flex-col gap-[18px]">
          <div className="flex flex-col gap-3 pt-2">
            <p className={authEyebrow}>{copy.script}</p>
            <h1 className={authH}>{mode === "signin" ? <>Log in to your <i>constellation</i></> : copy.title}</h1>
          </div>
          {copy.lede && <p className="twc-lede">{copy.lede}</p>}

          {/* Off unless the server has GOOGLE_CLIENT_ID/SECRET: a dead button is worse than none. */}
          {showTabs && import.meta.env.VITE_GOOGLE_AUTH === "true" && (
            <>
              <button type="button" onClick={google} className="twc-btn twc-btn--outline w-full">
                <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3ZM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Zm-5.6-8c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14ZM12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6Z" /></svg>
                Continue with Google
              </button>
              <div className="flex items-center gap-3 text-[13px] text-sb-muted"><span className="h-px flex-1 bg-sb-ink/25" />or with email<span className="h-px flex-1 bg-sb-ink/25" /></div>
            </>
          )}

          <form onSubmit={submit} className="twc-form flex flex-col gap-[18px]">
            {mode === "signup" && field("name", "Full name", { autoComplete: "name" })}
            {field("email", "Email", { type: "email", autoComplete: "email" })}
            {mode !== "forgot" && field(
              "password", "Password",
              { type: "password", minLength: 8, autoComplete: mode === "signup" ? "new-password" : "current-password" },
              mode === "signin" ? <button type="button" onClick={() => switchTo("forgot")} className={cn(slink, "text-[13px]")}>Forgot password?</button> : undefined,
              mode === "signup" ? "At least 8 characters." : undefined,
            )}
            {error && <p id="auth-error" role="alert" className={authAlert}>{error}</p>}
            {notice && (
              <div role="status" className="twc-notice twc-notice--mint">
                <h2 className="twc-notice__title">{notice.title}</h2>
                <p className="text-[15px]">{notice.text}</p>
              </div>
            )}
            <button type="submit" disabled={busy} aria-busy={busy || undefined} className="twc-btn mt-1 self-start">{copy.submit}</button>
          </form>

          <p className="flex flex-col items-center gap-2 text-center text-sm">
            {mode === "forgot" && <button type="button" onClick={() => switchTo("signin")} className={slink}>Back to sign in</button>}
            <Link to="/join" className={slink}>Not a member yet? Apply</Link>
          </p>
        </div>
      </div>
    </AuthFrame>
  );
}
