// The /contact form: inline errors from the shared check, then POST /api/contact; on success a confirmation
// replaces the form.
import { useRef, useState, type FormEvent } from "react";
import { Icon } from "@/app/layout/twc";
import { sendContact } from "./mutations";
import { checkContact, LIMITS, TOPICS, type ContactErrors, type ContactField, type ContactInput } from "./schema";

const FIELDS: ContactField[] = ["name", "email", "topic", "message"];

export function ContactForm({ send = sendContact }: { send?: (input: ContactInput) => Promise<void> }) {
  const [errors, setErrors] = useState<ContactErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const thanks = useRef<HTMLHeadingElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = checkContact(Object.fromEntries(new FormData(event.currentTarget)));
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
      // The form (and its focused button) is gone: move focus to the confirmation so it is announced.
      requestAnimationFrame(() => thanks.current?.focus());
    } catch (error) {
      setFailure((error as Error).message || "We couldn’t send your message just now. Please try again in a little while.");
    } finally {
      setSending(false);
    }
  }

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-md bg-sb-mint px-6 py-12 text-center sm:px-8">
        <span className="twc-ticket__meta"><span>Message received</span></span>
        <h2 ref={thanks} tabIndex={-1} className="twc-h3 text-[32px] outline-none sm:text-[40px]">Thanks for reaching out.</h2>
        <p className="max-w-[420px] text-[17px] [overflow-wrap:anywhere]">We’ll be in touch at {sentTo}.</p>
      </div>
    );
  }

  const describe = (f: ContactField) => (errors[f] ? `c-${f}-error` : undefined);
  const error = (f: ContactField) => errors[f] && <p id={`c-${f}-error`} className="twc-error">{errors[f]}</p>;

  return (
    <form
      ref={form}
      onSubmit={submit}
      noValidate
      aria-label="Contact form"
      className="flex flex-col gap-6 rounded-md bg-sb-paper p-5 shadow-[0_10px_28px_rgba(31,31,28,0.12)] sm:p-10"
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
        <div className="twc-field">
          <label htmlFor="c-name">Your name</label>
          <input className="twc-input" id="c-name" name="name" type="text" autoComplete="name" required maxLength={LIMITS.name}
            aria-invalid={errors.name ? true : undefined} aria-describedby={describe("name")} />
          {error("name")}
        </div>
        <div className="twc-field">
          <label htmlFor="c-email">Email</label>
          <input className="twc-input" id="c-email" name="email" type="email" autoComplete="email" required maxLength={LIMITS.email}
            aria-invalid={errors.email ? true : undefined} aria-describedby={describe("email")} />
          {error("email")}
        </div>
      </div>
      <fieldset className="twc-field m-0 border-0 p-0" aria-describedby={describe("topic")}>
        <legend className="twc-label mb-2.5">What’s it about?</legend>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t, i) => (
            <label key={t} className="twc-choice">
              <input type="radio" name="topic" value={t} defaultChecked={i === 0} />{t}
            </label>
          ))}
        </div>
        {error("topic")}
      </fieldset>
      <div className="twc-field">
        <label htmlFor="c-message">Message</label>
        <textarea className="twc-input" id="c-message" name="message" rows={6} required maxLength={LIMITS.message}
          aria-invalid={errors.message ? true : undefined} aria-describedby={describe("message")} />
        {error("message")}
      </div>
      {failure && (
        <div role="alert" className="twc-notice twc-notice--danger">
          <p className="twc-notice__title">Your message didn’t send.</p>
          <p className="text-[15px]">{failure}</p>
        </div>
      )}
      <button type="submit" className="twc-btn self-start" disabled={sending}>
        {sending ? "Sending…" : "Send message"} <Icon name="arrow" className="twc-arrow" />
      </button>
    </form>
  );
}
