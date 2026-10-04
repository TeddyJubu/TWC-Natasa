import * as React from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Badge, BrandLockup, Button, FormField, FormNotice, Heading, Input, Text, cn } from "@/index";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import hero from "@/assets/photography/hero.jpg";

export const Route = createFileRoute("/auth")({
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

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = React.useState<Mode>("signin");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/account" }); });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/account" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "");
    const password = String(f.get("password") ?? "");
    setBusy(true); setError(null); setNotice(null);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin + "/account", data: { full_name: String(f.get("name") ?? "") } },
      });
      if (error) setError(error.message);
      else setNotice("Check your inbox to confirm your email. Once confirmed, sign in to finish your profile.");
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
      if (error) setError(error.message);
      else setNotice("If that email belongs to a member, a reset link is on its way.");
    }
    setBusy(false);
  }

  async function google() {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) setError(result.error.message ?? "Google sign-in didn’t work. Please try again.");
  }

  const titles: Record<Mode, string> = { signin: "Welcome Back, Neighbor", signup: "Open Your Member Account", forgot: "Reset Your Password" };

  return (
    <main className="grid min-h-screen bg-canvas text-ink lg:grid-cols-[1.05fr_1fr]">
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
            <div role="tablist" aria-label="Account" className="grid grid-cols-2 border-b border-line">
              {(["signin", "signup"] as const).map((m) => (
                <button key={m} role="tab" type="button" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); setNotice(null); }}
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

          {mode !== "forgot" && (
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
              <FormField label="Full name" htmlFor="name" index="01"><Input id="name" name="name" required autoComplete="name" /></FormField>
            )}
            <FormField label="Email" htmlFor="email" index={mode === "signup" ? "02" : "01"}><Input id="email" name="email" type="email" required autoComplete="email" /></FormField>
            {mode !== "forgot" && (
              <FormField label="Password" htmlFor="password" index={mode === "signup" ? "03" : "02"} hint={mode === "signup" ? "At least 8 characters." : undefined}>
                <Input id="password" name="password" type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} aria-describedby={mode === "signup" ? "password-hint" : undefined} />
              </FormField>
            )}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            {notice && <FormNotice title="Almost there" tone="accent">{notice}</FormNotice>}
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
    </main>
  );
}

const buttonLinkClass = "text-ink-muted underline underline-offset-4 hover:text-ink";
