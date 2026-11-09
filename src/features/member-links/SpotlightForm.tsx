// The Weekly Spotlight form behind a personal link (/spotlight?t=…): native validation first, then the shared check,
// then POST /api/spotlight. On success a confirmation replaces the form; the link is used up on the server.
import * as React from "react";
import { Icon } from "@/app/layout/twc";
import { Choices, Field, Input, Notice, Section } from "@/features/applications/twc-fields";
import { sendSpotlight, type SpotlightPrefill, type SpotlightSubmission } from "./queries";
import { IDENTITY, SPOTLIGHT_LIMITS, SPOTLIGHT_QUESTIONS, checkSpotlight, fieldName } from "./spotlight";

const SECTIONS = [
  { section: 2, index: "02 — Your story", title: "Your story", description: "In your own words. The first four are required." },
  { section: 3, index: "03 — The community", title: "The community", description: "All optional — answer whatever you like." },
] as const;

export function SpotlightForm({ token, prefill, send = sendSpotlight }: {
  token: string; prefill: SpotlightPrefill; send?: (input: SpotlightSubmission) => Promise<void>;
}) {
  const [failure, setFailure] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const alert = React.useRef<HTMLElement>(null);
  const thanks = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (failure) alert.current?.focus();
  }, [failure]);
  React.useEffect(() => {
    if (done) thanks.current?.focus();
  }, [done]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const checked = checkSpotlight(data);
    if ("errors" in checked) {
      setFailure(Object.values(checked.errors)[0]!);
      return;
    }
    setFailure(null);
    setBusy(true);
    try {
      await send({ ...data, token, honeypot: data.honeypot ?? "" });
      setDone(true);
    } catch (error) {
      setFailure((error as Error).message || "We couldn’t save your answers just now. Please try again in a little while.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div ref={thanks} tabIndex={-1} role="status" className="flex flex-col items-center gap-4 rounded-[6px] bg-sb-mint px-6 py-16 text-center outline-none sm:px-8">
        <span className="twc-ticket__meta">Answers received</span>
        <h2 className="twc-h3">Thank you.</h2>
        <p className="max-w-[520px] text-[17px]">Your answers are with The Women’s Collective. We’ll be in touch before anything is published.</p>
        <ul className="max-w-[520px] list-disc pl-5 text-left text-[15px] text-sb-muted">
          <li>Nothing is published automatically.</li>
          <li>This link is now closed and cannot be used again.</li>
        </ul>
      </div>
    );
  }

  const pending = { "aria-disabled": busy || undefined, className: "aria-disabled:cursor-progress" };
  return (
    <form className="relative rounded-[6px] bg-sb-paper p-5 shadow-[inset_0_0_0_1px_rgb(31_31_28/0.15)] sm:p-12" onSubmit={submit} aria-busy={busy}>
      <div className="flex flex-col gap-12">
        <Section index="01 — About you" title="About you" description="Prefilled from our private records. Correct anything that has changed.">
          <div className="grid gap-[22px] sm:grid-cols-2">
            {IDENTITY.map(({ name, label }, i) => (
              <Field key={name} id={`s-${name}`} label={label} optional={i > 0}>
                <Input name={name} required={i === 0} defaultValue={prefill.values[name]} autoComplete={name === "full_name" ? "name" : undefined}
                  maxLength={SPOTLIGHT_LIMITS.identity} />
              </Field>
            ))}
          </div>
        </Section>
        {SECTIONS.map((s) => (
          <Section key={s.section} index={s.index} title={s.title} description={s.description}>
            {SPOTLIGHT_QUESTIONS.filter((q) => q.section === s.section).map((q) => {
              const name = fieldName(q.key);
              if (q.kind === "yesno") return <Choices key={name} type="radio" name={name} legend={q.label} options={["Yes", "No"]} optional />;
              return (
                <Field key={name} id={`s-${name}`} label={q.label} optional={!q.required} hint={q.help}>
                  {q.kind === "url"
                    ? <Input name={name} type="url" placeholder="https://" maxLength={SPOTLIGHT_LIMITS.answer} />
                    : <textarea name={name} className="twc-input" rows={4} required={q.required} maxLength={SPOTLIGHT_LIMITS.answer} />}
                </Field>
              );
            })}
          </Section>
        ))}
        {/* Honeypot: off-screen and out of the tab order and accessibility tree; people never fill it, bots do. */}
        <p aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>If you can see this, leave it empty <input name="honeypot" type="text" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
        </p>
        <div className="flex flex-col gap-6">
          {failure && (
            <Notice ref={alert} tabIndex={-1} role="alert" tone="danger" title="One more thing" className="outline-none">
              <p>{failure}</p>
            </Notice>
          )}
          <div>
            <button type="submit" {...pending} className={`twc-btn ${pending.className}`}>Send my Spotlight answers <Icon name="arrow" className="twc-arrow" /></button>
          </div>
        </div>
      </div>
    </form>
  );
}
