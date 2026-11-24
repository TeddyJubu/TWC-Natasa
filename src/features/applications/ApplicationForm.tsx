import * as React from "react";
import { Icon } from "@/app/layout/twc";
import { useCopy } from "@/features/form-copy/use-copy";
import { GUIDELINES, LIMITS, communityOptions, connectionOptions, eventOptions, heardOptions, industryOptions, parseApplication, supportOptions, type ApplicationInput, type Area } from "./schema";
import { ApplicationProgress } from "./ApplicationProgress";
import { FieldErrors, applyDraft, canStoreDrafts, clearDrafts, collectDraft, collectErrors, readDraft, saveDraft, type DraftValues, type FieldError } from "./form-state";
import { Check, Choices, Field, Input, LongAnswer, Notice, Section, Select } from "./twc-fields";

const yesNo = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];

/** A date as `<input type="date">` wants it, in the applicant's own time zone. */
const localDay = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/** Moves to a field from the error summary, centred so the sticky bars can't cover it. */
function focusField(id: string) {
  const field = document.getElementById(id);
  if (!field) return;
  field.focus({ preventScroll: true });
  (field.closest("[data-question], .twc-check") ?? field).scrollIntoView?.({ block: "center" });
}

/** Conditional follow-up questions sit in a tinted panel under the answer that opened them. */
const followUp = "motion-panel-in flex flex-col gap-5 rounded-[6px] bg-sb-cream p-5 sm:p-6";

export interface ApplicationFormProps {
  /** Sends the parsed application; reject to show the inline error with Retry. */
  submit: (application: ApplicationInput) => Promise<void>;
  /** Prefills name and email (e.g. for a signed-in applicant) without overwriting anything already typed. */
  initial?: { fullName?: string; email?: string };
  /** Offer "Review another application" after success (showcase demo only). */
  resettable?: boolean;
  /** Called instead of showing the in-place confirmation (the live /join moves on to /join/thanks). */
  onSent?: () => void;
  /** The area she chose: its neighborhoods and its question. */
  area: Area;
}

/** Name of the hidden anti-spam field; deliberately not a real application field. */
const HONEYPOT = "fax-number";

/** `invalid`: the parser rejected the answers (clears on the next edit). `send`: the insert failed (offers Retry). */
type Failure = { kind: "invalid" | "send"; message: string };

export function ApplicationForm({ submit, initial, resettable, onSent, area }: ApplicationFormProps) {
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent">("idle");
  const [failure, setFailure] = React.useState<Failure | null>(null);
  const [errors, setErrors] = React.useState<FieldError[]>([]);
  // Counts failed submits, so a repeat with the same errors still moves focus to the summary.
  const [attempt, setAttempt] = React.useState(0);
  const [cleared, setCleared] = React.useState(false);
  const [round, setRound] = React.useState(0);
  // A ref, not state: a second submit can arrive before the "sending" render lands.
  const inFlight = React.useRef(false);
  const sent = () => (onSent ? onSent() : setStatus("sent"));

  // Submit and Retry both land here, so every attempt re-reads the current answers and re-runs validation.
  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    // Honeypot: only bots fill the hidden field. They get the normal success state and nothing is saved.
    if (new FormData(event.currentTarget).get(HONEYPOT)) return sent();
    const found = collectErrors(event.currentTarget);
    setErrors(found);
    if (found.length) {
      setFailure(null);
      setAttempt((n) => n + 1);
      return;
    }
    let application: ApplicationInput;
    try {
      application = parseApplication(new FormData(event.currentTarget));
    } catch (error) {
      setFailure({ kind: "invalid", message: error instanceof Error ? error.message : "Please check your answers and try again." });
      return;
    }
    inFlight.current = true;
    setStatus("sending");
    // Keep a send failure (and its Retry button, which may hold focus) on screen while retrying.
    setFailure((current) => (current?.kind === "send" ? current : null));
    try {
      await submit(application);
      clearDrafts();
      sent();
    } catch {
      setFailure({ kind: "send", message: "We couldn’t send your application. Your answers are still here, so please try again." });
      setStatus("idle");
    } finally {
      inFlight.current = false;
    }
  };

  const onEdit = (form: HTMLFormElement) => {
    setFailure((current) => (current?.kind === "invalid" ? null : current));
    // Only ever shrinks: a follow-up question that just opened isn't an error until the next submit.
    setErrors((current) => {
      if (!current.length) return current;
      const open = new Set(collectErrors(form).map((error) => error.key));
      const next = current.filter((error) => open.has(error.key));
      return next.length === current.length ? current : next;
    });
  };

  const onClear = () => {
    clearDrafts();
    setFailure(null);
    setErrors([]);
    setCleared(true);
    setRound((r) => r + 1);
  };

  if (status === "sent") return <Received onReset={resettable ? () => { setRound((r) => r + 1); setStatus("idle"); } : undefined} />;

  return (
    <ApplicationFields
      area={area}
      key={round}
      initial={initial}
      busy={status === "sending"}
      failure={failure}
      errors={errors}
      attempt={attempt}
      cleared={cleared}
      // The showcase specimen must never read or write a real applicant's draft.
      drafts={!resettable}
      onSubmit={(event) => void onSubmit(event)}
      onEdit={onEdit}
      onClear={onClear}
    />
  );
}

function Received({ onReset }: { onReset?: () => void }) {
  const t = useCopy();
  const panel = React.useRef<HTMLDivElement>(null);
  // The long form is gone, so move focus to the confirmation instead of leaving it on a removed button.
  React.useEffect(() => panel.current?.focus(), []);
  return (
    <div ref={panel} tabIndex={-1} role="status" className="motion-panel-in scroll-mt-28 flex flex-col items-center gap-4 rounded-[6px] bg-sb-sun px-6 py-16 text-center outline-none sm:px-8">
      <span className="twc-ticket__meta">{t("Application received")}</span>
      <p aria-hidden className="inline-flex items-center gap-2 font-script text-[36px] leading-[1.1]">thank you <Icon name="sparkle" className="size-6" /></p>
      <h2 className="twc-h3">{t("Thank you for introducing yourself.")}</h2>
      <p className="max-w-[520px] text-[17px]">{t("We are excited to learn more about you and your work. Your application will be reviewed, and we will contact you if we need anything else.")}</p>
      {onReset && <button type="button" className="twc-btn mt-2" onClick={onReset}>Review another application</button>}
    </div>
  );
}

interface FieldsProps {
  area: Area;
  initial?: ApplicationFormProps["initial"];
  busy: boolean;
  failure: Failure | null;
  errors: FieldError[];
  attempt: number;
  cleared: boolean;
  drafts: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onEdit: (form: HTMLFormElement) => void;
  onClear: () => void;
}

type DraftState = "ready" | "saved" | "restored" | "cleared" | "unavailable";
const DRAFT_NOTE: Record<DraftState, string> = {
  ready: "Your answers save on this device as you go, except your signature and consents.",
  saved: "Saved on this device, except your signature and consents.",
  restored: "Your saved answers are back. Please sign and tick the consent boxes again.",
  cleared: "Your saved answers are gone from this device.",
  unavailable: "This browser can’t save a draft, so keep this page open until you send it.",
};

function ApplicationFields({ area, initial, busy, failure, errors, attempt, cleared, drafts, onSubmit, onEdit, onClear }: FieldsProps) {
  const t = useCopy();
  const [industry, setIndustry] = React.useState<string[]>([]);
  const [newsletter, setNewsletter] = React.useState("");
  const [partner, setPartner] = React.useState("no");
  const [draftState, setDraftState] = React.useState<DraftState>(cleared ? "cleared" : "ready");
  const [restored, setRestored] = React.useState<DraftValues | null>(null);
  const [confirmingClear, setConfirmingClear] = React.useState(false);
  const form = React.useRef<HTMLFormElement>(null);
  const savedDraft = React.useRef<DraftValues | null>(null);

  // After hydration, so the server's HTML still matches. Runs before the prefill below, which must not replace a draft.
  React.useEffect(() => {
    if (!drafts) return;
    if (!canStoreDrafts()) return setDraftState("unavailable");
    const values = readDraft();
    if (!values) return;
    savedDraft.current = values;
    setIndustry(values.industry ?? []);
    setPartner(values.partner?.[0] ?? "no");
    setRestored(values);
  }, [drafts]);
  // A second pass: the follow-up questions the draft opens exist only after the render above.
  React.useEffect(() => {
    if (!restored || !form.current) return;
    applyDraft(form.current, restored);
    setDraftState("restored");
  }, [restored]);

  // Prefill arrives asynchronously; fill only fields that are still empty so nothing typed is overwritten.
  const nameInput = React.useRef<HTMLInputElement>(null);
  const emailInput = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (initial?.fullName && nameInput.current && !nameInput.current.value && !savedDraft.current?.["full-name"]) nameInput.current.value = initial.fullName;
  }, [initial?.fullName]);
  React.useEffect(() => {
    if (initial?.email && emailInput.current && !emailInput.current.value && !savedDraft.current?.email) emailInput.current.value = initial.email;
  }, [initial?.email]);

  // Set here, not in the markup: the server doesn't know the applicant's day. `max` also stops a browser taking a 6-digit year.
  const dateInput = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const input = dateInput.current;
    if (!input) return;
    const now = new Date();
    input.max = localDay(now);
    input.min = localDay(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));
    if (!input.value) input.value = input.max;
  }, []);

  // Clearing replaces every field, so put focus back at the start of the form.
  React.useEffect(() => {
    if (cleared) nameInput.current?.focus();
  }, [cleared]);

  // The message sits at the end of a long form, so move focus to it whenever a new one appears.
  const alert = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (failure) alert.current?.focus();
  }, [failure]);
  const summary = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (attempt) summary.current?.focus();
  }, [attempt]);
  const errorsByField = React.useMemo(() => new Map(errors.map((error) => [error.key, error.message])), [errors]);

  const onFormChange = (event: React.FormEvent<HTMLFormElement>) => {
    onEdit(event.currentTarget);
    setConfirmingClear(false);
    if (!drafts) return;
    const ok = saveDraft(collectDraft(event.currentTarget));
    setDraftState((current) => (!ok ? "unavailable" : current === "restored" ? current : "saved"));
  };

  // aria-disabled rather than disabled while sending: a disabled button would drop keyboard focus.
  const pending = { "aria-disabled": busy || undefined, className: "aria-disabled:cursor-progress" };

  return (
    <FieldErrors.Provider value={errorsByField}>
    {/* noValidate: the browser would stop at the first problem; collectErrors reports them all. */}
    <form ref={form} noValidate className="rounded-[6px] bg-sb-paper p-5 shadow-[inset_0_0_0_1px_rgb(31_31_28/0.15)] sm:p-12" onSubmit={onSubmit} onChange={onFormChange} aria-busy={busy}>
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Leave this field empty<input name={HONEYPOT} type="text" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <ApplicationProgress form={form} errorCount={errors.length} onShowErrors={() => summary.current?.focus()} />
      {drafts && (
        <div className="mb-10 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] leading-relaxed text-sb-muted">
          <p role="status" className="max-w-[56ch]">{DRAFT_NOTE[draftState]}</p>
          {(draftState === "saved" || draftState === "restored") && (
            <button
              type="button"
              className="min-h-11 font-medium text-sb-blue-ink underline underline-offset-2"
              onBlur={() => setConfirmingClear(false)}
              onClick={() => (confirmingClear ? onClear() : setConfirmingClear(true))}
            >
              {confirmingClear ? "Press again to erase all answers" : "Clear saved answers"}
            </button>
          )}
        </div>
      )}
      <div className="flex flex-col gap-12">
        <input type="hidden" name="area" value={area.id} />
        <Section index="01 — Personal information" title="Start with you." description="Private details stay private unless you explicitly authorize publication.">
          <div className="grid gap-[22px] sm:grid-cols-2">
            <Field id="full-name" label="Full name"><Input ref={nameInput} name="full-name" autoComplete="name" maxLength={LIMITS.fullName} required /></Field>
            <Field id="preferred-name" label="Preferred name" optional><Input name="preferred-name" /></Field>
            <Field id="pronouns" label="Pronouns" optional><Input name="pronouns" /></Field>
            <Field id="email" label="Email address"><Input ref={emailInput} name="email" type="email" autoComplete="email" maxLength={254} required /></Field>
            <Field id="phone" label="Phone number"><Input name="phone" type="tel" autoComplete="tel" required /></Field>
            <Field id="neighborhood" label="Where are you based?" hint="Just your neighborhood, not your street address."><Input name="neighborhood" maxLength={LIMITS.neighborhood} required /></Field>
          </div>
          <Choices name="connection" legend={area.connection} hint="Select all that apply." options={connectionOptions} required />
        </Section>

        <Section index="02 — About your work" title="Share what you do." description="Help members understand your work in your own words.">
          <div className="grid gap-[22px] sm:grid-cols-2">
            <Field id="business" label="Business or organization name" optional><Input name="business" /></Field>
            <Field id="role" label="Professional title or role"><Input name="role" required /></Field>
            <Field id="website" label="Business website" optional><Input name="website" type="url" /></Field>
            <Field id="instagram" label="Instagram" optional><Input name="instagram" /></Field>
            <Field id="linkedin" label="LinkedIn" optional><Input name="linkedin" type="url" /></Field>
            <Field id="social" label="Other social or professional profile" optional><Input name="social" type="url" /></Field>
          </div>
          <Field id="story" label="Tell us about yourself and your work"><LongAnswer name="story" rows={4} required /></Field>
          <Choices name="industry" legend="Industry" hint="Select all that apply." options={industryOptions} required onValueChange={setIndustry} />
          {industry.includes("Other") && <div className={followUp}><Field id="other-industry" label="Describe your industry"><Input name="other-industry" required /></Field></div>}
        </Section>

        <Section index="03 — Community connections" title="Find your people." description="Tell us what meaningful support looks like for you.">
          <Choices name="community-goals" legend="What are you hoping to find through the collective?" options={communityOptions} required />
          <div className="grid gap-[22px] sm:grid-cols-2">
            <Field id="ideal-referral" label="Your ideal referral or connection"><LongAnswer name="ideal-referral" required /></Field>
            <Field id="community-support" label="How can the community support you?" optional><LongAnswer name="community-support" /></Field>
          </div>
          <Choices name="member-support" legend="How would you like to support other members?" options={supportOptions} required />
          <Choices type="radio" name="coffee" legend="Are you open to one-to-one meetings or coffee chats?" optional options={["Yes — in person", "Yes — virtually", "Yes — either", "Not at this time"]} />
          <Choices name="contact-preference" legend="How do you prefer members to contact you?" optional options={["Email", "Phone", "Text", "WhatsApp", "Instagram", "LinkedIn"]} />
          <Field id="local-shoutout" label="Shout out a local business, organization, or resource you love" optional><LongAnswer name="local-shoutout" /></Field>
        </Section>

        <Section index="04 — Events and partnerships" title="Take part your way." description="Attend, contribute, host, or collaborate.">
          <Choices name="events" legend="How would you like to participate in events?" optional options={eventOptions} />
          <Choices type="radio" name="partner" legend="Would you like to become a sponsor or community partner?" defaultValue="no" onValueChange={([value]) => setPartner(value)} options={[yesNo[0], { value: "maybe", label: "Maybe" }, yesNo[1]]} />
          {partner !== "no" && <div className={followUp}><Field id="partner-interest" label="Describe your interest"><LongAnswer name="partner-interest" required /></Field></div>}
        </Section>

        <Section index="05 — Communication" title="Stay in the loop." description="Choose what reaches your inbox.">
          <Choices type="radio" name="newsletter" legend="Receive news, event invitations, opportunities, and updates?" optional onValueChange={([value]) => setNewsletter(value)} options={yesNo} />
          {newsletter === "yes" && <Check name="newsletter-consent" label="I consent to receive collective email and understand I can unsubscribe at any time." required />}
          <Choices type="radio" name="application-contact" legend="May we contact you directly about your application?" optional options={["Email", "Phone", "Text", "WhatsApp", "Any of these"]} />
        </Section>

        <Section index="06 — Community guidelines" title="Keep it generous." description="Confirm each commitment before submitting.">
          {/* Every guideline is its own required commitment. */}
          <fieldset className="min-w-0">
            <legend className="twc-label mb-4">Community guidelines</legend>
            <div className="flex flex-col gap-4">{GUIDELINES.map((guideline) => <Check key={guideline} name="guidelines" value={guideline} label={guideline} required />)}</div>
          </fieldset>
          <Notice title="Privacy and membership">
            <p>We use submitted information to review applications, communicate with applicants, and manage community programs and events.</p>
            <p>Private information is not intentionally published. Information you choose to share in member groups or at events may be visible to other participants. The collective may moderate spaces and decline or remove participation when needed to protect the community.</p>
          </Notice>
        </Section>

        <Section index="07 — Final confirmation" title="Make it official." description="One final review, then send.">
          <div className="grid gap-[22px] sm:grid-cols-2">
            <Field id="heard" label="How did you hear about us?" optional><Select name="heard" defaultValue=""><option value="">Choose one</option>{heardOptions.map((item) => <option key={item}>{item}</option>)}</Select></Field>
            <Field id="referrer" label="Name of the member who referred you" optional><Input name="referrer" /></Field>
            <Field id="signature" label="Electronic signature" hint="Type your full name to sign."><Input name="signature" required /></Field>
            <Field id="date" label="Date"><Input ref={dateInput} name="date" type="date" required /></Field>
          </div>
          <Check name="final-confirmation" className="rounded-[6px] bg-sb-cream p-[18px]" label="By submitting, I confirm that I have read, understood, and agreed to the permissions, statements, and community guidelines in this application." required />
          {errors.length > 0 && (
            <Notice ref={summary} id="application-errors" tabIndex={-1} role="alert" tone="danger" title={`Please fix ${errors.length} ${errors.length === 1 ? "answer" : "answers"} before sending`} className="scroll-mt-44 outline-none">
              <ul className="flex flex-col gap-2.5">
                {errors.map((error) => (
                  <li key={error.key}>
                    <a href={`#${error.targetId}`} className="underline underline-offset-2" onClick={(event) => { event.preventDefault(); focusField(error.targetId); }}>{error.question}</a>
                    <span className="block text-[13px] text-sb-danger">{error.message}</span>
                  </li>
                ))}
              </ul>
            </Notice>
          )}
          {failure && (
            <Notice ref={alert} tabIndex={-1} role="alert" tone="danger" title={failure.kind === "send" ? "We couldn’t send that yet" : "One more thing"} className="scroll-mt-28 outline-none">
              <p>{failure.message}</p>
              {/* A second submit button: Retry re-reads and re-validates the form as it is now. */}
              {failure.kind === "send" && <button type="submit" {...pending} className={`twc-btn twc-btn--sm self-start ${pending.className}`}>Retry</button>}
            </Notice>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" {...pending} className={`twc-btn ${pending.className}`}>{t("Submit application")} <Icon name="arrow" className="twc-arrow" /></button>
            <p className="max-w-md text-[13px] leading-relaxed text-sb-muted">Leaving an optional question unanswered never counts as permission.</p>
          </div>
        </Section>
      </div>
    </form>
    </FieldErrors.Provider>
  );
}
