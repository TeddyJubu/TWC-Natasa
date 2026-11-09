// The member review form behind a personal link (/review?t=…): native validation first, then the shared check,
// then POST /api/review. On success a confirmation replaces the form; the link is used up on the server.
import * as React from "react";
import { Icon } from "@/app/layout/twc";
import { Check, Choices, Field, Input, Notice, Section } from "@/features/applications/twc-fields";
import { sendReview, type ReviewPrefill, type ReviewSubmission } from "./queries";
import { CORRECTIONS, INFO_FIELDS, LIMITS, MEMBERSHIP, PERMISSIONS, PUBLIC_FIELDS, checkReview } from "./schema";

const INPUT_TYPE: Partial<Record<string, string>> = { email: "email", website_social: "url" };
const AUTOCOMPLETE: Partial<Record<string, string>> = { full_name: "name", email: "email" };

export function ReviewForm({ token, prefill, send = sendReview }: {
  token: string; prefill: ReviewPrefill; send?: (input: ReviewSubmission) => Promise<void>;
}) {
  const [failure, setFailure] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [directory, setDirectory] = React.useState("");
  const alert = React.useRef<HTMLElement>(null);
  const thanks = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (failure) alert.current?.focus();
  }, [failure]);
  // The form (and its focused button) is gone: move focus to the confirmation so it is announced.
  React.useEffect(() => {
    if (done) thanks.current?.focus();
  }, [done]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const checked = checkReview({
      ...Object.fromEntries(data), public_fields: data.getAll("public_fields"), correction_requests: data.getAll("correction_requests"),
    });
    if ("errors" in checked) {
      setFailure(Object.values(checked.errors)[0]!);
      return;
    }
    setFailure(null);
    setBusy(true);
    try {
      await send({ ...checked.value, token, honeypot: String(data.get("honeypot") ?? "") });
      setDone(true);
    } catch (error) {
      setFailure((error as Error).message || "We couldn’t save your review just now. Please try again in a little while.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div ref={thanks} tabIndex={-1} role="status" className="flex flex-col items-center gap-4 rounded-[6px] bg-sb-mint px-6 py-16 text-center outline-none sm:px-8">
        <span className="twc-ticket__meta">Response received</span>
        <h2 className="twc-h3">Thank you — your response is saved.</h2>
        <p className="max-w-[520px] text-[17px]">Your choices have been recorded. A person will review them before anything changes.</p>
        <ul className="max-w-[520px] list-disc pl-5 text-left text-[15px] text-sb-muted">
          <li>Nothing is published automatically.</li>
          <li>If you asked for a correction or removal, it will be handled by a person who will contact you.</li>
          <li>This link is now closed and cannot be used again.</li>
        </ul>
      </div>
    );
  }

  const pending = { "aria-disabled": busy || undefined, className: "aria-disabled:cursor-progress" };
  return (
    <form className="relative rounded-[6px] bg-sb-paper p-5 shadow-[inset_0_0_0_1px_rgb(31_31_28/0.15)] sm:p-12" onSubmit={submit} aria-busy={busy}>
      <div className="flex flex-col gap-12">
        <Section index="01 — Your information" title="Your information" description="Prefilled from our private records. Correct anything that has changed.">
          <div className="grid gap-[22px] sm:grid-cols-2">
            {INFO_FIELDS.map(({ name, label }, i) => (
              <Field key={name} id={`r-${name}`} label={label} optional={i > 1}>
                <Input name={name} type={INPUT_TYPE[name] ?? "text"} required={i < 2} defaultValue={prefill.values[name]}
                  autoComplete={AUTOCOMPLETE[name]} maxLength={name === "full_name" ? LIMITS.name : name === "email" ? LIMITS.email : LIMITS.text}
                  placeholder={name === "website_social" ? "https://" : undefined} />
              </Field>
            ))}
          </div>
        </Section>
        <Section index="02 — Membership" title="Membership" description="Choose one.">
          <Choices type="radio" name={MEMBERSHIP.name} legend={MEMBERSHIP.legend} options={[...MEMBERSHIP.options]} />
        </Section>
        <Section index="03 — Permissions" title="Your permissions, separately" description="Each of these is its own decision. Say yes, no, or leave anything blank.">
          {PERMISSIONS.map((p) => (
            <React.Fragment key={p.name}>
              <Choices type="radio" name={p.name} legend={p.legend} options={[...p.options]} optional
                onValueChange={p.name === "directory" ? (v) => setDirectory(v[0] ?? "") : undefined} />
              {p.name === "directory" && directory === "public" && (
                <Choices name="public_fields" legend="If public, which fields may appear?" hint="Applies only to a public listing" options={[...PUBLIC_FIELDS]} required />
              )}
            </React.Fragment>
          ))}
          <p className="text-[13px] text-sb-muted">Leaving a question unanswered means we will treat it as unanswered — never as a yes.</p>
        </Section>
        <Section index="04 — Corrections" title="Corrections & removal requests" description="Tick anything you would like us to do. A person handles each request.">
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="sr-only">Corrections and removal requests</legend>
            {CORRECTIONS.map((c) => <Check key={c.value} name="correction_requests" value={c.value} label={c.label} />)}
          </fieldset>
          <div className="twc-field">
            <label htmlFor="correction_request">Anything we should correct, or details about your request<span className="ml-2 text-[13px] font-normal normal-case tracking-normal text-sb-muted">Optional</span></label>
            <textarea id="correction_request" name="other_note" className="twc-input" rows={4} maxLength={LIMITS.note} />
          </div>
          {/* Honeypot: off-screen and out of the tab order and accessibility tree; people never fill it, bots do. */}
          <p aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label>If you can see this, leave it empty <input name="honeypot" type="text" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
          </p>
          {failure && (
            <Notice ref={alert} tabIndex={-1} role="alert" tone="danger" title="One more thing" className="outline-none">
              <p>{failure}</p>
            </Notice>
          )}
          <div>
            <button type="submit" {...pending} className={`twc-btn ${pending.className}`}>Submit my review <Icon name="arrow" className="twc-arrow" /></button>
          </div>
        </Section>
      </div>
    </form>
  );
}
