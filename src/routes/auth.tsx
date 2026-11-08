import * as React from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Badge, BrandLockup, Button, FormField, FormNotice, Heading, ImageTrail, Input, Text, cn } from "@/index";
import { getAuthClient } from "@/app/auth-client";
import { emitAuthEvent } from "@/app/auth-events";
import hero from "@/assets/photography/hero.jpg";

type Mode = "signin" | "signup" | "forgot";
const MODES: readonly string[] = ["signin", "signup", "forgot"];

export const Route = createFileRoute("/auth")({
  // `/auth?mode=forgot` lets other pages (e.g. an expired reset link) open the right form.
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

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setModeState] = React.useState<Mode>(Route.useSearch().mode ?? "signin");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const setMode = (next: Mode) => {
    setModeState(next);
    setError(null);
    setNotice(null);
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
      const { error } = await auth.signUp.email({ email, password, name: String(f.get("name") ?? ""), callbackURL: "/account" });
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

  const titles: Record<Mode, string> = { signin: "Welcome Back, Neighbor", signup: "Open Your Member Account", forgot: "Reset Your Password" };

  return (
    <main id="main" tabIndex={-1} className="grid min-h-screen outline-none bg-canvas text-ink lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:block">
        <img src={hero} alt="Soft sky over Western Queens" className="absolute inset-0 size-full object-cover" />
        <div aria-hidden className="bg-sky-fade absolute inset-0" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link to="/" aria-label="Home"><BrandLockup logoVariant="white" /></Link>
          <div className="motion-stagger flex max-w-md flex-col gap-6">
            <Badge variant="glass" className="self-start">Members only</Badge>
            <p className="font-display text-5xl leading-[1.1]">Your profile, your gatherings, your introductions.</p>
            <p className="text-white/85">Accounts open fully once your membership application is approved.</p>
          </div>
        </div>
      </aside>

      <section className="flex flex-col justify-center px-6 py-16 md:px-16">
        <div className="mx-auto flex w-full max-w-md flex-col gap-10">
          <Link to="/" className="lg:hidden" aria-label="Home"><BrandLockup compact /></Link>
          {mode !== "forgot" && (
            <div role="group" aria-label="Sign in or create an account" className="grid grid-cols-2 border-b border-line">
              {(["signin", "signup"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                  className={cn("-mb-px border-b-2 pb-3 text-left text-sm transition-colors", mode === m ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink")}>
                  {m === "signin" ? "01 — Sign in" : "02 — Create account"}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-4">
            <Heading as="h1" size="title" className="md:text-5xl">{titles[mode]}</Heading>
            <Text tone="muted" size="sm">
              {mode === "signup" ? "Create your login now; your profile unlocks once the collective approves your application." : mode === "forgot" ? "We’ll send a link to choose a new password." : "Sign in to update your profile and see what’s happening nearby."}
            </Text>
          </div>

          {/* Off unless the server has GOOGLE_CLIENT_ID/SECRET: a dead button is worse than none. */}
          {mode !== "forgot" && import.meta.env.VITE_GOOGLE_AUTH === "true" && (
            <>
              <Button type="button" variant="outline" size="lg" onClick={google} className="w-full">
                <svg aria-hidden viewBox="0 0 24 24" className="mr-2 inline-block size-5 align-[-4px]"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3ZM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Zm-5.6-8c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14ZM12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6Z" /></svg>
                Continue with Google
              </Button>
              <div className="flex items-center gap-4 text-xs uppercase text-ink-muted"><span className="h-px flex-1 bg-line" />or with email<span className="h-px flex-1 bg-line" /></div>
            </>
          )}

          <form onSubmit={submit} className="flex flex-col gap-8" noValidate={false}>
            {mode === "signup" && (
              <FormField label="Full name" htmlFor="name" index="01"><Input name="name" required autoComplete="name" /></FormField>
            )}
            <FormField label="Email" htmlFor="email" index={mode === "signup" ? "02" : "01"}><Input name="email" type="email" required autoComplete="email" /></FormField>
            {mode !== "forgot" && (
              <FormField label="Password" htmlFor="password" index={mode === "signup" ? "03" : "02"} hint={mode === "signup" ? "At least 8 characters." : undefined}>
                <Input name="password" type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
              </FormField>
            )}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            {notice && <FormNotice role="status" title="Almost there" tone="accent" headingAs="h2">{notice}</FormNotice>}
            <Button type="submit" variant="ink" size="lg" state={busy ? "loading" : "idle"} className="w-full">
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </Button>
          </form>

          <div className="flex flex-wrap justify-between gap-3 text-sm">
            {mode === "signin" ? <Button variant="link" type="button" onClick={() => setMode("forgot")}>Forgot password?</Button>
              : <Button variant="link" type="button" onClick={() => setMode("signin")}>Back to sign in</Button>}
            <Link to="/join" className={buttonLinkClass}>Not a member yet? Apply</Link>
          </div>
        </div>
      </section>
      <ImageTrail />
    </main>
  );
}

const buttonLinkClass = "text-ink-muted underline underline-offset-4 hover:text-ink";
