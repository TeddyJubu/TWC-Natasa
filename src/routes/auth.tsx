import * as React from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { cn } from "@/index";
import { getAuthClient } from "@/app/auth-client";
import { emitAuthEvent } from "@/app/auth-events";
import { AuthFrame, authAlert, authCard, authH, authScript, slink } from "@/app/auth-ui";
import { Icon } from "@/app/layout/twc";
import sky from "@/assets/photography/site/auth-sky.webp";

type Mode = "signin" | "signup" | "forgot";
const MODES: readonly string[] = ["signin", "signup", "forgot"];

export const Route = createFileRoute("/auth")({
  // `/auth?mode=signup` opens Create account and `/auth?mode=forgot` the reset form (e.g. from an expired link).
  validateSearch: (search: Record<string, unknown>): { mode?: Mode } =>
    typeof search.mode === "string" && MODES.includes(search.mode) ? { mode: search.mode as Mode } : {},
  head: () => ({
    meta: [
      { title: "Member Sign In — The Women’s Collective" },
      { name: "description", content: "Sign in or create your account to manage your Women’s Collective member profile." },
      { property: "og:title", content: "Member Sign In — The Women’s Collective" },
      { property: "og:description", content: "Your profile, gatherings, and introductions in one place." },
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
const ALREADY_EXISTS = ["USER_ALREADY_EXISTS", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"];
const PASSWORD_RULES = ["PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG"];

const COPY: Record<Mode, { script: string; title: string; lede: string; submit: string }> = {
  signin: { script: "good to see you", title: "Welcome back, neighbor.", lede: "Sign in to update your profile and see what’s happening nearby.", submit: "Sign in" },
  signup: { script: "hello, neighbor", title: "Open your member account", lede: "Create your login now; your profile unlocks once the collective approves your application.", submit: "Create account" },
  forgot: { script: "it happens", title: "Reset your password", lede: "We’ll send a link to choose a new password.", submit: "Send reset link" },
};
const TABS = [["signin", "Sign in"], ["signup", "Create account"]] as const;

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setModeState] = React.useState<Mode>(Route.useSearch().mode ?? "signin");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const tabs = React.useRef<(HTMLButtonElement | null)[]>([]);
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
      if (!error || ALREADY_EXISTS.includes(error.code ?? "")) setNotice(SIGNUP_SENT);
      else if (PASSWORD_RULES.includes(error.code ?? "")) setError(error.message ?? "Please choose a password of 8 to 128 characters."); // the password rule, nothing about the email
      else setError("We couldn’t create your account right now. Please try again in a minute.");
    } else {
      const { error } = await auth.requestPasswordReset({ email, redirectTo: "/reset-password" });
      // Rate limits are per address, so reporting one would confirm the account exists.
      if (!error || error.status === 429) setNotice(RESET_SENT);
      else setError("We couldn’t send a link right now. Please try again in a minute.");
    }
    setBusy(false);
  }

  async function google() {
    setError(null);
    const { error } = await (await getAuthClient()).signIn.social({ provider: "google", callbackURL: "/account", errorCallbackURL: "/auth" });
    if (error) setError("Google sign-in didn’t work. Please try again.");
  }

  // ARIA tabs: arrows (and Home/End) move between the two tabs and select them; only the selected one is in the tab order.
  function onTabKey(e: React.KeyboardEvent, index: number) {
    const to = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = (to + TABS.length) % TABS.length;
    setMode(TABS[next][0]);
    tabs.current[next]?.focus();
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
      <div className="twc-wrap grid items-start justify-center gap-10 [grid-template-columns:minmax(0,480px)] min-[981px]:[grid-template-columns:minmax(0,1fr)_minmax(0,480px)_minmax(0,1fr)]">
        <div className="order-2 flex flex-col gap-7 min-[981px]:order-none min-[981px]:items-end min-[981px]:pt-10">
          <figure className="twc-polaroid twc-polaroid--left hidden w-full max-w-[230px] min-[981px]:flex">
            <img src={sky} alt="City rooftops under a soft pink and lilac sky at dusk" width={1067} height={1600} loading="lazy" className="aspect-[4/5]" />
          </figure>
          <div className="flex min-w-0 flex-col gap-2.5 self-stretch">
            <span className="twc-chip twc-chip--ring self-start">Members only</span>
            <p className="font-display text-2xl leading-[1.2]">Your profile, your gatherings, your introductions.</p>
            <p className="text-sm leading-normal text-sb-muted">Accounts open fully once your membership application is approved.</p>
          </div>
        </div>

        <div className={authCard}>
          {showTabs && (
            <div role="tablist" aria-label="Sign in or create an account" className="flex gap-1 rounded-full p-1 shadow-[inset_0_0_0_1px_rgb(31_31_28/0.25)]">
              {TABS.map(([m, label], i) => (
                <button key={m} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" id={`tab-${m}`}
                  aria-selected={mode === m} aria-controls="auth-panel" tabIndex={mode === m ? 0 : -1}
                  onClick={() => setMode(m)} onKeyDown={(e) => onTabKey(e, i)}
                  className={cn("min-h-10 flex-1 cursor-pointer rounded-full font-display text-[13px] uppercase leading-5 tracking-[1.6px] max-[400px]:text-[12px] max-[400px]:tracking-[0.8px] outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sb-blue-ink motion-reduce:transition-none",
                    mode === m ? "bg-sb-ink text-sb-paper" : "text-sb-ink hover:bg-sb-ink/5")}>
                  {label}
                </button>
              ))}
            </div>
          )}

          <div id="auth-panel" role={showTabs ? "tabpanel" : undefined} aria-labelledby={showTabs ? `tab-${mode}` : undefined} className="flex flex-col gap-[18px]">
            <div className="flex flex-col gap-2.5 pt-2">
              <p className={authScript}>{copy.script}</p>
              <h1 className={authH}>{copy.title}</h1>
            </div>
            <p className="text-sb-muted">{copy.lede}</p>

            {/* Off unless the server has GOOGLE_CLIENT_ID/SECRET: a dead button is worse than none. */}
            {showTabs && import.meta.env.VITE_GOOGLE_AUTH === "true" && (
              <>
                <button type="button" onClick={google} className="twc-btn twc-btn--outline w-full">
                  <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3ZM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Zm-5.6-8c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14ZM12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6Z" /></svg>
                  Continue with Google
                </button>
                <div className="flex items-center gap-3 text-[13px] text-sb-muted"><span className="h-px flex-1 bg-sb-ink/15" />or with email<span className="h-px flex-1 bg-sb-ink/15" /></div>
              </>
            )}

            <form onSubmit={submit} className="flex flex-col gap-[18px]">
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
                  <h2 className="twc-notice__title">Almost there</h2>
                  <p className="text-[15px]">{notice}</p>
                </div>
              )}
              <button type="submit" disabled={busy} aria-busy={busy || undefined} className="twc-btn mt-1 w-full">
                {copy.submit} <Icon name="arrow" className="twc-arrow" />
              </button>
            </form>

            <p className="flex flex-col items-center gap-2 text-center text-sm">
              {mode === "forgot" && <button type="button" onClick={() => switchTo("signin")} className={slink}>Back to sign in</button>}
              <Link to="/join" className={slink}>Not a member yet? Apply</Link>
            </p>
          </div>
        </div>

        <div aria-hidden className="hidden min-[981px]:block" />
      </div>
    </AuthFrame>
  );
}
