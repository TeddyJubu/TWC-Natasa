// The RSVP panel. A signed-in member answers in one tap as herself (setMemberRsvp, her account's email); anyone else
// fills the form, and a later change proves "this is me" with the uid Cal returned, kept on this device. A full event
// offers its waitlist (event_waitlist, 0021), since Cal has none.
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/index";
import { setRsvpFn } from "@/features/events/fns";
import { isEnded, isFull } from "./event-state";
import { CapacityBar } from "./events-ui";
import { setMemberWaitlistFn } from "./fns";
import {
  CalRequestError, invalidateCal, joinWaitlist, lastRsvp, memberEventRsvpQuery, rememberWaitlist, sendRsvp, storedRsvp, storeRsvp,
  waitlistedHere, type LastRsvp,
} from "./queries";
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

const WAITLISTED = "You’re on the waitlist.";
const calendarEntry = (event: CalEvent) => ({
  uid: event.uid, title: event.title, description: event.description, location: event.location,
  startTime: event.startTime, endTime: event.endTime,
  url: typeof window === "undefined" ? undefined : `${window.location.origin}/events/${encodeURIComponent(event.slug)}`,
});

export function RsvpConfirmation({ event, rsvp, onChange }: { event: CalEvent; rsvp: LastRsvp; onChange: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-display text-[32px] font-extrabold leading-none [font-stretch:75%]">{CONFIRMED[rsvp.status]}</p>
      <p className="text-sm">
        {rsvp.name ? `${rsvp.name} · ` : ""}{rsvp.email}
        {rsvp.status === "GOING" && rsvp.plusOnes > 0 ? ` · bringing ${rsvp.plusOnes}` : ""}
      </p>
      {rsvp.status !== "NOT_GOING" && <AddToCalendar entry={calendarEntry(event)} />}
      <button type="button" className="twc-btn twc-btn--outline twc-btn--sm w-fit" onClick={onChange}>Change my RSVP</button>
    </div>
  );
}

type Problem = { code: string; message: string };

export function RsvpForm({ event, initial, business, onSaved, onWaitlisted }: {
  event: CalEvent; initial?: LastRsvp; business?: string; onSaved: (rsvp: LastRsvp, message: string) => void;
  onWaitlisted?: (email: string) => void;
}) {
  const queryClient = useQueryClient();
  // A full event can't take a Going, so a new answer starts on Maybe.
  const [status, setStatus] = React.useState<RsvpStatus>(initial?.status ?? (isFull(event) ? "MAYBE" : "GOING"));
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

  /** Name and email only: the waitlist keeps no answer, guests or note. */
  const waitlist = async () => {
    if (busy) return;
    const checked = checkRsvp({ name, email, status: "MAYBE" });
    if (!checked.ok) {
      setErrors({ ...(checked.errors.name ? { name: checked.errors.name } : {}), ...(checked.errors.email ? { email: checked.errors.email } : {}) });
      setProblem({ code: "VALIDATION", message: "Add your name and email to join the waitlist." });
      return;
    }
    setErrors({});
    setProblem(null);
    setBusy(true);
    try {
      await joinWaitlist(event.uid, { name: checked.value.name, email: checked.value.email, ...(business ? { business } : {}) });
      rememberWaitlist(event.uid, checked.value.email);
      void invalidateCal(queryClient);
      onWaitlisted?.(checked.value.email);
    } catch (error) {
      const failure = error instanceof CalRequestError ? error : new CalRequestError("Something went wrong. Please try again.", "UNAVAILABLE", 0);
      setProblem({ code: failure.code, message: failure.message });
    } finally {
      setBusy(false);
    }
  };
  const full = isFull(event) || problem?.code === "EVENT_FULL";

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
          {problem.code === "SPOTS_OPEN" && (
            <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" disabled={busy} onClick={() => void submit("GOING")}>RSVP as going</button>
          )}
          {(problem.code === "NETWORK" || problem.code === "UNAVAILABLE") && (
            <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" disabled={busy} onClick={() => void submit(status)}>Try again</button>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="twc-btn w-fit" disabled={busy}>{busy ? "Sending…" : initial ? "Update my RSVP" : "Send my RSVP"}</button>
        {full && onWaitlisted && <button type="button" className="twc-btn twc-btn--outline w-fit" disabled={busy} onClick={() => void waitlist()}>Join the waitlist</button>}
      </div>
      {/* Announces every outcome, including refusals, without moving focus. */}
      <p role="status" aria-live="polite" className="sr-only">{busy ? "Sending your RSVP" : problem?.message ?? ""}</p>
    </form>
  );
}

/** `checking` while the page still asks who is looking, so a member never sees the guest form flash first. */
export function RsvpPanel({ event, business, member = false, checking = false }: { event: CalEvent; business?: string; member?: boolean; checking?: boolean }) {
  const closed = event.status === "CANCELLED" ? "This event has been cancelled." : isEnded(event) ? "This event has ended." : null;
  return (
    // tabIndex: the page's early "RSVP" button on small screens moves focus here.
    <aside id="rsvp" tabIndex={-1} aria-labelledby="rsvp-title" className="twc-card flex flex-col gap-5 self-start bg-sb-cream outline-none lg:sticky lg:top-28">
      <h2 id="rsvp-title" className="twc-h3">Are you coming?</h2>
      <CapacityBar event={event} />
      {/* Members answer through her account on the club's own calendar; another business's event takes the form. */}
      {closed ? <p>{closed}</p> : checking ? <p role="status" className="text-sm">Loading…</p> : member && !business ? <MemberRsvp event={event} /> : <GuestRsvp event={event} business={business} />}
    </aside>
  );
}

function GuestRsvp({ event, business }: { event: CalEvent; business?: string }) {
  const [saved, setSaved] = React.useState<LastRsvp | undefined>(undefined);
  const [waiting, setWaiting] = React.useState<string | undefined>(undefined);
  const [editing, setEditing] = React.useState(false);
  const [announce, setAnnounce] = React.useState("");
  React.useEffect(() => {
    setSaved(lastRsvp(event.uid));
    setWaiting(waitlistedHere(event.uid));
  }, [event.uid]);
  const full = isFull(event);
  return (
    <>
      {waiting && !editing && saved?.status !== "GOING" ? (
        <div className="flex flex-col gap-4">
          <p className="font-display text-[32px] font-extrabold leading-none [font-stretch:75%]">{WAITLISTED}</p>
          <p className="text-sm">{waiting} · The host sees your place in line.</p>
          <button type="button" className="twc-btn twc-btn--outline twc-btn--sm w-fit" onClick={() => { setEditing(true); setAnnounce(""); }}>Change my RSVP</button>
        </div>
      ) : saved && !editing ? (
        <RsvpConfirmation event={event} rsvp={saved} onChange={() => { setEditing(true); setAnnounce(""); }} />
      ) : (
        <>
          {full && !saved && <p className="text-sm">This event is full. Join the waitlist, or say maybe.</p>}
          <RsvpForm
            key={saved ? `${saved.email}-${saved.status}` : "new"} event={event} initial={saved} business={business}
            onSaved={(rsvp, message) => { setSaved(rsvp); setEditing(false); setAnnounce(message); }}
            onWaitlisted={(email) => { setWaiting(email); setEditing(false); setAnnounce(WAITLISTED); }}
          />
        </>
      )}
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
    </>
  );
}

/** One tap per answer, saved as her; her current answer is read from Cal, so it is the same on every device. */
function MemberRsvp({ event }: { event: CalEvent }) {
  const queryClient = useQueryClient();
  const mine = useQuery(memberEventRsvpQuery(event.uid));
  const [problem, setProblem] = React.useState<string | null>(null);
  const [announce, setAnnounce] = React.useState("");
  const done = (message: string) => {
    setProblem(null);
    setAnnounce(message);
    return invalidateCal(queryClient);
  };
  const fail = (error: unknown) => {
    setAnnounce("");
    setProblem((error as Error | null)?.message || "Something went wrong. Please try again.");
  };
  const answer = useMutation({
    mutationFn: (status: RsvpStatus) => setRsvpFn({ data: { eventId: event.uid, status } }),
    onSuccess: (_saved, status) => done(CONFIRMED[status]),
    onError: fail,
  });
  const wait = useMutation({
    mutationFn: (on: boolean) => setMemberWaitlistFn({ data: { eventId: event.uid, on } }),
    onSuccess: (_saved, on) => done(on ? WAITLISTED : "You’ve left the waitlist."),
    onError: fail,
  });
  // A failed refetch keeps the answer already shown; only a first read that fails asks to try again.
  if (!mine.data && !mine.isError) return <p role="status" className="text-sm">Loading your RSVP…</p>;
  if (!mine.data) {
    return (
      <div className="twc-notice twc-notice--danger flex flex-col items-start gap-3">
        <p>We couldn’t load your RSVP.</p>
        <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" onClick={() => void mine.refetch()}>Try again</button>
      </div>
    );
  }
  const { status, plusOnes, waitlisted } = mine.data;
  const busy = answer.isPending || wait.isPending;
  const full = isFull(event) && status !== "GOING";
  return (
    <div className="flex flex-col gap-4">
      <p className="font-display text-[32px] font-extrabold leading-none [font-stretch:75%]">
        {status && status !== "NOT_GOING" ? CONFIRMED[status] : waitlisted ? WAITLISTED : status ? CONFIRMED[status] : full ? "This event is full." : "Tap your answer."}
      </p>
      {status === "GOING" && plusOnes > 0 && <p className="text-sm">Bringing {plusOnes}</p>}
      <div role="group" aria-label="Your answer" className="flex flex-wrap gap-2">
        {RSVP_STATUSES.map((s) => (
          <button
            key={s} type="button" aria-pressed={status === s} disabled={busy || (s === "GOING" && full)}
            className={cn("twc-btn twc-btn--sm", status !== s && "twc-btn--outline")} onClick={() => answer.mutate(s)}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {full && (waitlisted ? (
        <button type="button" className="twc-btn twc-btn--outline twc-btn--sm w-fit" disabled={busy} onClick={() => wait.mutate(false)}>Leave the waitlist</button>
      ) : (
        <button type="button" className="twc-btn twc-btn--sm w-fit" disabled={busy} onClick={() => wait.mutate(true)}>Join the waitlist</button>
      ))}
      {(status === "GOING" || status === "MAYBE") && <AddToCalendar entry={calendarEntry(event)} />}
      {problem && <p role="alert" className="twc-notice twc-notice--danger">{problem}</p>}
      <p role="status" aria-live="polite" className="sr-only">{busy ? "Saving your answer" : announce}</p>
    </div>
  );
}
