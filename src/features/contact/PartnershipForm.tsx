// The /partnerships inquiry form: inline errors from the shared check, then POST /api/partnerships; on success
// a confirmation replaces the form. Same shape as ContactForm.
import { Link } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { Icon } from "@/app/layout/twc";
import { sendPartnership } from "./partnership-mutation";
import { checkPartnership, COLLABORATIONS, PARTNERSHIP_LIMITS as L, type PartnershipErrors, type PartnershipField, type PartnershipInput } from "./partnership";

const FIELDS: PartnershipField[] = ["name", "email", "business", "collaboration_type", "message", "consent"];

export function PartnershipForm({ send = sendPartnership }: { send?: (input: PartnershipInput) => Promise<void> }) {
  const [errors, setErrors] = useState<PartnershipErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const thanks = useRef<HTMLHeadingElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = checkPartnership(Object.fromEntries(new FormData(event.currentTarget)));
    setFailure(null);
    if ("errors" in checked) {
      setErrors(checked.errors);
      const first = FIELDS.find((f) => checked.errors[f]);
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setErrors({});
    setSending(true);
    try {
      await send(checked.value);
      setSentTo(checked.value.email);
      requestAnimationFrame(() => thanks.current?.focus());
    } catch (error) {
      setFailure((error as Error).message || "We couldn’t send your inquiry just now. Please try again in a little while.");
    } finally {
      setSending(false);
    }
  }

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-md bg-sb-mint px-6 py-12 text-center sm:px-8">
        <span className="twc-ticket__meta"><span>Inquiry received</span></span>
        <h3 ref={thanks} tabIndex={-1} className="twc-h3 text-[32px] outline-none sm:text-[40px]">Thanks for writing.</h3>
        <p className="max-w-[420px] text-[17px] [overflow-wrap:anywhere]">We’ll be in touch at {sentTo}.</p>
      </div>
    );
  }

  const describe = (f: PartnershipField) => (errors[f] ? `p-${f}-error` : undefined);
  const error = (f: PartnershipField) => errors[f] && <p id={`p-${f}-error`} className="twc-error">{errors[f]}</p>;
  const invalid = (f: PartnershipField) => (errors[f] ? true : undefined);

  return (
    <form ref={form} onSubmit={submit} noValidate aria-label="Partnership inquiry"
      className="relative flex flex-col gap-6 rounded-md bg-sb-paper p-5 shadow-[0_10px_28px_rgba(31,31,28,0.12)] sm:p-10">
      {/* Honeypot: off-screen, out of the tab order and hidden from screen readers; people leave it empty. */}
      <div aria-hidden className="pointer-events-none absolute -left-[9999px] size-px overflow-hidden">
        <label htmlFor="p-honeypot">Leave this field empty</label>
        <input id="p-honeypot" name="honeypot" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
        <div className="twc-field">
          <label htmlFor="p-name">Your name</label>
          <input className="twc-input" id="p-name" name="name" type="text" autoComplete="name" required maxLength={L.name}
            aria-invalid={invalid("name")} aria-describedby={describe("name")} />
          {error("name")}
        </div>
        <div className="twc-field">
          <label htmlFor="p-email">Email</label>
          <input className="twc-input" id="p-email" name="email" type="email" autoComplete="email" required maxLength={L.email}
            aria-invalid={invalid("email")} aria-describedby={describe("email")} />
          {error("email")}
        </div>
      </div>
      <div className="twc-field">
        <label htmlFor="p-business">Business</label>
        <input className="twc-input" id="p-business" name="business" type="text" autoComplete="organization" required maxLength={L.business}
          aria-invalid={invalid("business")} aria-describedby={describe("business")} />
        {error("business")}
      </div>
      <fieldset className="twc-field m-0 border-0 p-0" aria-describedby={describe("collaboration_type")}>
        <legend className="twc-label mb-2.5">Type of collaboration</legend>
        <div className="flex flex-wrap gap-2">
          {COLLABORATIONS.map((c, i) => (
            <label key={c.value} className="twc-choice">
              <input type="radio" name="collaboration_type" value={c.value} defaultChecked={i === 0} />{c.label}
            </label>
          ))}
        </div>
        {error("collaboration_type")}
      </fieldset>
      <div className="twc-field">
        <label htmlFor="p-message">What did you have in mind?</label>
        <textarea className="twc-input" id="p-message" name="message" rows={6} required maxLength={L.message}
          aria-invalid={invalid("message")} aria-describedby={["p-message-hint", describe("message")].filter(Boolean).join(" ")} />
        <p id="p-message-hint" className="twc-hint">A couple of sentences is plenty. Include your neighborhood if it’s relevant.</p>
        {error("message")}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <label className="twc-check" htmlFor="p-consent">
          <input id="p-consent" name="consent" type="checkbox" required aria-invalid={invalid("consent")} aria-describedby={describe("consent")} />
          <span>I’m happy for The Women’s Collective to hold these details in order to reply. Nothing is added to any mailing list. See the{" "}
            <Link to="/privacy" className="twc-inlink">privacy policy</Link>.</span>
        </label>
        {error("consent")}
      </div>
      {failure && (
        <div role="alert" className="twc-notice twc-notice--danger">
          <p className="twc-notice__title">Your inquiry didn’t send.</p>
          <p className="text-[15px]">{failure}</p>
        </div>
      )}
      <button type="submit" className="twc-btn self-start" disabled={sending}>
        {sending ? "Sending…" : "Send inquiry"} <Icon name="arrow" className="twc-arrow" />
      </button>
    </form>
  );
}
