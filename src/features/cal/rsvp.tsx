// The RSVP panel. Anyone can answer; a later change proves "this is me" with the uid Cal returned, kept on this device.
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isEnded, isFull } from "./event-state";
import { CapacityBar } from "./events-ui";
import { CalRequestError, invalidateCal, lastRsvp, sendRsvp, storedRsvp, storeRsvp, type LastRsvp } from "./queries";
import { checkRsvp, MAX_PLUS_ONES, RSVP_STATUSES, type CalEvent, type RsvpStatus } from "./types";
import { AddToCalendar, FormField } from "./ui";

const STATUS_LABEL: Record<RsvpStatus, string> = { GOING: "Going", MAYBE: "Maybe", NOT_GOING: "Can’t go" };
const CONFIRMED: Record<RsvpStatus, string> = {
  GOING: "You’re going. See you there!",
  MAYBE: "You’re down as a maybe.",
  NOT_GOING: "Thanks for letting us know.",
};

export function RsvpStatusSelector({ value, onChange, disabled }: { value: RsvpStatus; onChange: (status: RsvpStatus) => void; disabled?: boolean }) {
  const name = React.useId();
  return (
    <fieldset className="flex flex-col gap-2.5" disabled={disabled}>
      <legend className="twc-label mb-2">Your answer</legend>
      <div className="flex flex-wrap gap-2">
        {RSVP_STATUSES.map((s) => (
          <label key={s} className="twc-choice">
            <input type="radio" name={name} value={s} checked={value === s} onChange={() => onChange(s)} className="sr-only" />
            {STATUS_LABEL[s]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function RsvpConfirmation({ event, rsvp, onChange }: { event: CalEvent; rsvp: LastRsvp; onChange: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-display text-[32px] font-extrabold leading-none [font-stretch:75%]">{CONFIRMED[rsvp.status]}</p>
      <p className="text-sm">
        {rsvp.name ? `${rsvp.name} · ` : ""}{rsvp.email}
        {rsvp.status === "GOING" && rsvp.plusOnes > 0 ? ` · bringing ${rsvp.plusOnes}` : ""}
      </p>
      {rsvp.status !== "NOT_GOING" && (
        <AddToCalendar entry={{
          uid: event.uid, title: event.title, description: event.description, location: event.location,
          startTime: event.startTime, endTime: event.endTime,
          url: typeof window === "undefined" ? undefined : `${window.location.origin}/events/${encodeURIComponent(event.slug)}`,
        }} />
      )}
      <button type="button" className="twc-btn twc-btn--outline twc-btn--sm w-fit" onClick={onChange}>Change my RSVP</button>
    </div>
  );
}

type Problem = { code: string; message: string };

export function RsvpForm({ event, initial, business, onSaved }: {
  event: CalEvent; initial?: LastRsvp; business?: string; onSaved: (rsvp: LastRsvp, message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<RsvpStatus>(initial?.status ?? "GOING");
  const [name, setName] = React.useState(initial?.name ?? "");
  const [email, setEmail] = React.useState(initial?.email ?? "");
  const [plusOnes, setPlusOnes] = React.useState(String(initial?.plusOnes ?? 0));
  const [note, setNote] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [problem, setProblem] = React.useState<Problem | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (answer: RsvpStatus) => {
    if (busy) return;
    const raw = { name, email, status: answer, note, ...(answer === "GOING" ? { plusOnes: Number(plusOnes) } : { plusOnes: 0 }) };
    const checked = checkRsvp(raw);
    if (!checked.ok) {
      setErrors(checked.errors);
      setProblem({ code: "VALIDATION", message: "Please fix the highlighted fields." });
      return;
    }
    setErrors({});
    setProblem(null);
    setBusy(true);
    try {
      const rsvpUid = storedRsvp(event.uid, checked.value.email);
      const saved = await sendRsvp(event.uid, { ...checked.value, ...(rsvpUid ? { rsvpUid } : {}), ...(business ? { business } : {}) });
      const rsvp: LastRsvp = { email: checked.value.email, name: checked.value.name, status: saved.status, plusOnes: saved.plusOnes ?? 0 };
      storeRsvp(event.uid, rsvp, saved.uid);
      void invalidateCal(queryClient);
      onSaved(rsvp, CONFIRMED[saved.status]);
    } catch (error) {
      const failure = error instanceof CalRequestError ? error : new CalRequestError("Something went wrong. Please try again.", "UNAVAILABLE", 0);
      setStatus(answer);
      setProblem({ code: failure.code, message: failure.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form noValidate className="flex flex-col gap-5" aria-label={`RSVP to ${event.title}`} onSubmit={(e) => { e.preventDefault(); void submit(status); }}>
      <RsvpStatusSelector value={status} onChange={(s) => { setStatus(s); setProblem(null); }} disabled={busy} />
      <FormField label="Your name" required error={errors.name}>
        {(p) => <input {...p} className="twc-input" autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}
      </FormField>
      <FormField label="Email" required error={errors.email} hint="Only the host sees this.">
        {(p) => <input {...p} type="email" className="twc-input" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />}
      </FormField>
      {status === "GOING" && (
        <FormField label="Guests you’re bringing" error={errors.plusOnes}>
          {(p) => <input {...p} type="number" inputMode="numeric" min={0} max={MAX_PLUS_ONES} className="twc-input" value={plusOnes} onChange={(e) => setPlusOnes(e.target.value)} />}
        </FormField>
      )}
      <FormField label="Note for the host" error={errors.note}>
        {(p) => <textarea {...p} className="twc-input" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />}
      </FormField>
      {problem && (
        <div className="twc-notice twc-notice--danger flex flex-col items-start gap-3">
          <p>{problem.code === "RSVP_EXISTS" ? "This email has already RSVP’d from another device. Open the page there to change it, or use a different email." : problem.message}</p>
          {problem.code === "EVENT_FULL" && (
            <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" disabled={busy} onClick={() => void submit("MAYBE")}>Put me down as a maybe</button>
          )}
          {(problem.code === "NETWORK" || problem.code === "UNAVAILABLE") && (
            <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" disabled={busy} onClick={() => void submit(status)}>Try again</button>
          )}
        </div>
      )}
      <button type="submit" className="twc-btn w-fit" disabled={busy}>{busy ? "Sending…" : initial ? "Update my RSVP" : "Send my RSVP"}</button>
      {/* Announces every outcome, including refusals, without moving focus. */}
      <p role="status" aria-live="polite" className="sr-only">{busy ? "Sending your RSVP" : problem?.message ?? ""}</p>
    </form>
  );
}

export function RsvpPanel({ event, business }: { event: CalEvent; business?: string }) {
  const [saved, setSaved] = React.useState<LastRsvp | undefined>(undefined);
  const [editing, setEditing] = React.useState(false);
  const [announce, setAnnounce] = React.useState("");
  React.useEffect(() => setSaved(lastRsvp(event.uid)), [event.uid]);
  const closed = event.status === "CANCELLED" ? "This event has been cancelled." : isEnded(event) ? "This event has ended." : null;
  return (
    <aside aria-labelledby="rsvp-title" className="twc-card flex flex-col gap-5 self-start bg-sb-cream lg:sticky lg:top-28">
      <h2 id="rsvp-title" className="twc-h3">Are you coming?</h2>
      <CapacityBar event={event} />
      {closed ? <p>{closed}</p> : saved && !editing ? (
        <RsvpConfirmation event={event} rsvp={saved} onChange={() => { setEditing(true); setAnnounce(""); }} />
      ) : (
        <>
          {isFull(event) && !saved && <p className="text-sm">This event is full. You can still say maybe.</p>}
          <RsvpForm
            key={saved ? `${saved.email}-${saved.status}` : "new"} event={event} initial={saved} business={business}
            onSaved={(rsvp, message) => { setSaved(rsvp); setEditing(false); setAnnounce(message); }}
          />
        </>
      )}
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
    </aside>
  );
}
