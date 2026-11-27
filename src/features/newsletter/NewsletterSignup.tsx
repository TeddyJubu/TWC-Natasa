// The email-only sign-up for the Collective's weekly letter: inline errors from the shared check, then
// POST /api/newsletter. The answer is the same for a new and a known address, so the thanks never says which.
// Native fields in the twc-* form classes, readable on a light card. A hidden honeypot travels with the sign-up.
import { useId, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/app/layout/twc";
import { sendSignup } from "./mutations";
import { checkSignup, EMAIL_MAX, type SignupErrors, type SignupRequest } from "./schema";

export type NewsletterSignupProps = {
  id?: string;
  className?: string;
  /** Tests pass their own; the page uses POST /api/newsletter. */
  send?: (input: SignupRequest) => Promise<void>;
};

export function NewsletterSignup({ id, className, send = sendSignup }: NewsletterSignupProps) {
  const uid = useId();
  const [errors, setErrors] = useState<SignupErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const thanks = useRef<HTMLParagraphElement>(null);
  const field = (name: string) => `${uid}-${name}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const checked = checkSignup({ email: data.get("email"), consent: data.get("consent") === "on" });
    setFailure(null);
    if ("errors" in checked) {
      setErrors(checked.errors);
      form.current?.querySelector<HTMLElement>(`[name="${checked.errors.email ? "email" : "consent"}"]`)?.focus();
      return;
    }
    setErrors({});
    setSending(true);
    try {
      await send({ ...checked.value, honeypot: String(data.get("honeypot") ?? "") });
      setSentTo(checked.value.email);
      // The form (and its focused button) is gone: move focus to the thanks so it is announced.
      requestAnimationFrame(() => thanks.current?.focus());
    } catch (error) {
      setFailure((error as Error).message || "We couldn’t add you just now. Please try again in a little while.");
    } finally {
      setSending(false);
    }
  }

  const describe = (f: keyof SignupErrors) => (errors[f] ? field(`${f}-error`) : undefined);
  const error = (f: keyof SignupErrors) => errors[f] && <p id={field(`${f}-error`)} className="twc-error">{errors[f]}</p>;

  return (
    <div id={id} className={className}>
      {/* Always mounted, so the thanks is announced when it fills. */}
      <div role="status" aria-live="polite">
        {sentTo && (
          <p ref={thanks} tabIndex={-1} className="m-0 text-[17px] text-sb-ink outline-none [overflow-wrap:anywhere]">
            Thanks. If {sentTo} isn’t on the list yet, a note to confirm it is on its way.
          </p>
        )}
      </div>
      {!sentTo && (
        <form ref={form} onSubmit={submit} noValidate aria-label="Newsletter sign-up" className="twc-form flex flex-col gap-4">
          <div className="twc-field">
            <label htmlFor={field("email")}>Email</label>
            <input className="twc-input" id={field("email")} name="email" type="email" autoComplete="email" required maxLength={EMAIL_MAX}
              aria-invalid={errors.email ? true : undefined} aria-describedby={describe("email")} />
            {error("email")}
          </div>
          <div className="twc-field">
            <label className="twc-check">
              <input type="checkbox" name="consent" required aria-invalid={errors.consent ? true : undefined} aria-describedby={describe("consent")} />
              <span>Send me the Collective letter. One email a week; unsubscribe any time.</span>
            </label>
            {error("consent")}
          </div>
          {/* Honeypot: off-screen and out of the tab order and accessibility tree; people never fill it, bots do. */}
          <p aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label>If you can see this, leave it empty <input name="honeypot" type="text" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
          </p>
          <div aria-live="assertive">
            {failure && (
              <div role="alert" className="twc-notice twc-notice--danger">
                <p className="twc-notice__title">You’re not signed up yet.</p>
                <p className="text-[15px]">{failure}</p>
              </div>
            )}
          </div>
          <button type="submit" className="twc-btn self-start" disabled={sending}>
            {sending ? "Signing you up…" : "Sign me up"} <Icon name="arrow" className="twc-arrow" />
          </button>
        </form>
      )}
    </div>
  );
}
