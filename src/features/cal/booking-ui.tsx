// Booking an appointment and managing it from its private link, on the canvas kit (twc-public.css).
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { MultiSelectControl, SelectControl } from "@/index";
import { calSlotsQuery, CalRequestError, invalidateCal, manageBooking, sendBooking } from "./queries";
import { browserTimeZone, firstWeekday, formatDay, formatRange, formatTime, monthCells, monthKey, shiftMonth, timeZones } from "./time";
import { checkBooking, isEmail, MAX_GUESTS, type BookingField, type CalSlot, type PublicBooking, type PublicEventType, type SlotsByDay } from "./types";
import { AddToCalendar, ConfirmDialog, ErrorBanner, FormField, StatusBadge, useVisitorLocale } from "./ui";

const utc = (day: string) => Date.parse(`${day}T12:00:00Z`);
const messageOf = (error: unknown) => (error as Error | null)?.message || "Something went wrong. Please try again.";

export function EventTypeCard({ type, business }: { type: PublicEventType; business?: string }) {
  return (
    <article className="twc-evcard">
      <div className="twc-evcard__body">
      <h2 className="font-display text-[34px] font-extrabold leading-none tracking-[-0.01em] break-words [font-stretch:75%]">
        <Link
          to="/book/$eventType" params={{ eventType: type.slug }} {...(business ? { search: { business } } : {})}
          className="after:absolute after:inset-0 after:rounded-(--twc-radius-card) after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-3 focus-visible:after:outline-sb-ink"
        >{type.title}</Link>
      </h2>
      {type.description && <p className="whitespace-pre-line text-sb-muted">{type.description}</p>}
      <p className="mt-auto flex flex-wrap gap-2 pt-2">
        <span className="twc-chip twc-chip--ring">{type.lengthInMinutes} min</span>
        {type.seatsPerSlot !== null && <span className="twc-chip twc-chip--ring">Group · {type.seatsPerSlot} seats</span>}
      </p>
      </div>
    </article>
  );
}

export function EventTypeList({ types, business }: { types: PublicEventType[]; business?: string }) {
  if (!types.length) {
    return <div className="border-t border-sb-ink bg-sb-cream px-6 py-8"><p className="font-display text-[32px] font-extrabold leading-none [font-stretch:75%]">Nothing to book just yet.</p><p className="mt-2">Check back soon.</p></div>;
  }
  return <ul className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">{types.map((t) => <li key={t.id}><EventTypeCard type={t} business={business} /></li>)}</ul>;
}

export function TimezoneSelect({ value, onChange }: { value: string; onChange: (timeZone: string) => void }) {
  const zones = React.useMemo(() => timeZones(value), [value]);
  return (
    <FormField label="Time zone">
      {(p) => <SelectControl {...p} className="twc-input" value={value} onValueChange={onChange}>{zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}</SelectControl>}
    </FormField>
  );
}

/** A month of days; only days with an open time can be picked. */
export function DatePicker({ month, minMonth, selected, available, onMonth, onSelect }: {
  month: string; minMonth: string; selected: string | null; available: Set<string>; onMonth: (month: string) => void; onSelect: (day: string) => void;
}) {
  const locale = useVisitorLocale();
  const cells = monthCells(month, firstWeekday(locale));
  const title = new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "long", year: "numeric" }).format(utc(`${month}-15`));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 aria-live="polite" className="font-display text-[26px] font-extrabold leading-none [font-stretch:75%]">{title}</h2>
        <div className="flex gap-2">
          <button type="button" aria-label="Previous month" disabled={month <= minMonth} className="twc-btn twc-btn--outline twc-btn--sm" onClick={() => onMonth(shiftMonth(month, -1))}>‹</button>
          <button type="button" aria-label="Next month" className="twc-btn twc-btn--outline twc-btn--sm" onClick={() => onMonth(shiftMonth(month, 1))}>›</button>
        </div>
      </div>
      <div className="twc-daypick grid-cols-7">
        {cells.slice(0, 7).map((d) => <span key={d} aria-hidden className="twc-daypick__dow">{new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "narrow" }).format(utc(d))}</span>)}
        {cells.map((day) => {
          const open = day.startsWith(month) && available.has(day);
          if (!day.startsWith(month)) return <span key={day} aria-hidden className="bg-sb-cream!" />;
          return (
            <button
              key={day} type="button" disabled={!open} aria-pressed={selected === day}
              aria-label={`${new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(utc(day))}${open ? "" : ", no times"}`}
              onClick={() => onSelect(day)}
              className="aspect-square"
            >{Number(day.slice(8))}</button>
          );
        })}
      </div>
    </div>
  );
}

export function SlotPicker({ slots, timeZone, selected, onSelect, locale: localeProp }: {
  slots: CalSlot[]; timeZone: string; selected: string | null; onSelect: (start: string) => void; locale?: string;
}) {
  const visitor = useVisitorLocale();
  const locale = localeProp ?? visitor;
  if (!slots.length) return <p className="text-sb-muted">Pick a day to see its times.</p>;
  return (
    <ul aria-label="Available times" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {slots.map((s) => (
        <li key={s.start}>
          <button
            type="button" aria-pressed={selected === s.start} onClick={() => onSelect(s.start)}
            className="twc-choice twc-choice--filter w-full justify-center"
          >
            {formatTime({ iso: s.start, timeZone, locale })}
            {s.seatsRemaining !== null && <span className="text-xs">· {s.seatsRemaining} left</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** A month of open times in the visitor's zone, shared by first booking and rescheduling. */
function useMonthSlots(eventTypeId: number, month: string, timeZone: string, bookingUid?: string, business?: string) {
  const [y, m] = month.split("-").map(Number);
  // Fixed for this page: `start` is part of the query key, so a fresh Date.now() on each render would refetch forever.
  const [now] = React.useState(() => Date.now());
  // A day either side, so a slot near midnight in a far zone still lands in this month.
  const start = new Date(Math.max(Date.UTC(y, m - 1, 0), now)).toISOString();
  const end = new Date(Date.UTC(y, m, 2)).toISOString();
  const query = useQuery(calSlotsQuery({ eventTypeId, start, end, timeZone, ...(bookingUid ? { bookingUid } : {}), ...(business ? { business } : {}) }));
  const days: SlotsByDay = React.useMemo(
    () => Object.fromEntries(Object.entries(query.data ?? {}).filter(([day, slots]) => day.startsWith(month) && slots.length > 0)),
    [query.data, month],
  );
  return { query, days };
}

function SlotChooser({ eventTypeId, timeZone, onTimeZone, slot, onSlot, bookingUid, business }: {
  eventTypeId: number; timeZone: string; onTimeZone: (z: string) => void; slot: string | null; onSlot: (start: string | null) => void; bookingUid?: string; business?: string;
}) {
  const minMonth = monthKey(new Date().toISOString(), timeZone);
  const [month, setMonth] = React.useState(minMonth);
  const [day, setDay] = React.useState<string | null>(null);
  const { query, days } = useMonthSlots(eventTypeId, month, timeZone, bookingUid, business);
  const available = React.useMemo(() => new Set(Object.keys(days)), [days]);
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <DatePicker month={month} minMonth={minMonth} selected={day} available={available} onMonth={(next) => { setMonth(next); setDay(null); onSlot(null); }} onSelect={(next) => { setDay(next); onSlot(null); }} />
        <TimezoneSelect value={timeZone} onChange={(next) => { onTimeZone(next); setDay(null); onSlot(null); }} />
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-[26px] font-extrabold leading-none [font-stretch:75%]">{day ? formatDay({ iso: `${day}T12:00:00Z`, timeZone: "UTC", locale: "en-US" }) : "Times"}</h2>
        {query.isError ? <ErrorBanner message="We couldn’t load the open times." onRetry={() => void query.refetch()} />
          : query.isPending ? <p role="status" className="text-sb-muted">Loading times…</p>
          : !available.size ? <p className="text-sb-muted">No open times this month. Try the next one.</p>
          : <SlotPicker slots={day ? days[day] ?? [] : []} timeZone={timeZone} selected={slot} onSelect={onSlot} />}
      </div>
    </div>
  );
}

type Answer = string | string[] | boolean;

/** Keeps the words as typed, so a comma survives until the next address; the form holds the parsed list. */
function MultiEmailInput({ emails, onEmails, ...input }: Omit<React.ComponentProps<"input">, "value" | "onChange"> & { emails: string[]; onEmails: (emails: string[]) => void }) {
  const [text, setText] = React.useState(emails.join(", "));
  return (
    <input
      {...input} type="text" inputMode="email" className="twc-input" value={text}
      onChange={(e) => { setText(e.target.value); onEmails(e.target.value.split(",").map((v) => v.trim()).filter(Boolean)); }}
    />
  );
}

/** One control per Cal field type; an unknown type falls back to a text box. */
function CustomField({ field, value, error, onChange }: { field: BookingField; value: Answer | undefined; error?: string; onChange: (value: Answer) => void }) {
  const text = typeof value === "string" ? value : "";
  const list = Array.isArray(value) ? value : [];
  const { label, required, placeholder, options, type } = field;
  const placeholderProp = placeholder ? { placeholder } : {};
  if (type === "boolean") {
    return (
      <div className="flex flex-col gap-1">
        <label className="twc-check"><input type="checkbox" checked={value === true} aria-invalid={error ? true : undefined} onChange={(e) => onChange(e.target.checked)} /><span>{label}{required && <span aria-hidden> *</span>}</span></label>
        {error && <p className="twc-error">{error}</p>}
      </div>
    );
  }
  if (type === "radio" || type === "checkbox") {
    const toggle = (option: string, on: boolean) => onChange(on ? [...list, option] : list.filter((v) => v !== option));
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="twc-label mb-1">{label}{required && <span aria-hidden> *</span>}</legend>
        {options.map((o) => (
          <label key={o} className="twc-check">
            {type === "radio"
              ? <input type="radio" name={field.slug} checked={text === o} onChange={() => onChange(o)} />
              : <input type="checkbox" checked={list.includes(o)} onChange={(e) => toggle(o, e.target.checked)} />}
            <span>{o}</span>
          </label>
        ))}
        {error && <p className="twc-error">{error}</p>}
      </fieldset>
    );
  }
  return (
    <FormField label={label} required={required} error={error} hint={type === "multiemail" ? "Separate emails with commas." : undefined}>
      {(p) => {
        if (type === "textarea") return <textarea {...p} {...placeholderProp} className="twc-input" maxLength={2000} value={text} onChange={(e) => onChange(e.target.value)} />;
        if (type === "select") {
          return <SelectControl {...p} className="twc-input" value={text} onValueChange={onChange}><option value="">Choose…</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}</SelectControl>;
        }
        if (type === "multiselect") {
          return (
            <MultiSelectControl {...p} className="twc-input" value={list} onValueChange={onChange}>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </MultiSelectControl>
          );
        }
        if (type === "multiemail") {
          return <MultiEmailInput {...p} {...placeholderProp} emails={list} onEmails={onChange} />;
        }
        const inputType = ({ email: "email", phone: "tel", url: "url", number: "number" } as Record<string, string>)[type] ?? "text";
        return <input {...p} {...placeholderProp} type={inputType} maxLength={inputType === "number" ? undefined : 2000} className="twc-input" value={text} onChange={(e) => onChange(e.target.value)} />;
      }}
    </FormField>
  );
}

function GuestFields({ guests, onChange, error }: { guests: string[]; onChange: (next: string[]) => void; error?: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="twc-label mb-1">Guests</legend>
      {guests.map((g, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="email" aria-label={`Guest ${i + 1} email`} className="twc-input" value={g} maxLength={254} aria-invalid={error ? true : undefined}
            onChange={(e) => onChange(guests.map((v, j) => (j === i ? e.target.value : v)))}
          />
          <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" aria-label={`Remove guest ${i + 1}`} onClick={() => onChange(guests.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      {guests.length < MAX_GUESTS && <button type="button" className="twc-btn twc-btn--outline twc-btn--sm w-fit" onClick={() => onChange([...guests, ""])}>Add a guest</button>}
      {error && <p className="twc-error">{error}</p>}
    </fieldset>
  );
}

export function BookingSummary({ title, lengthInMinutes, start, timeZone, end }: { title: string; lengthInMinutes: number; start?: string | null; end?: string; timeZone: string }) {
  const locale = useVisitorLocale();
  const finish = end ?? (start ? new Date(Date.parse(start) + lengthInMinutes * 60_000).toISOString() : undefined);
  return (
    <div className="flex flex-col gap-1 border-t border-sb-ink bg-sb-cream px-5 py-4">
      <p className="font-display text-[26px] font-extrabold leading-none [font-stretch:75%]">{title}</p>
      {start && finish ? <p className="text-sm">{formatRange(start, finish, timeZone, locale)}</p> : <p className="text-sm">{lengthInMinutes} minutes</p>}
    </div>
  );
}

export function BookingForm({ type, start, timeZone, business, onBooked, onSlotTaken }: {
  type: PublicEventType; start: string; timeZone: string; business?: string;
  onBooked: (booking: { uid: string; seatUid: string | null }) => void; onSlotTaken: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [guests, setGuests] = React.useState<string[]>([]);
  const [answers, setAnswers] = React.useState<Record<string, Answer>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [problem, setProblem] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const submit = async () => {
    const next: Record<string, string> = {};
    for (const f of type.fields) {
      const value = answers[f.slug];
      if (f.required && (value === undefined || value === "" || value === false || (Array.isArray(value) && !value.length))) next[f.slug] = "Please answer this.";
      if (f.type === "multiemail" && Array.isArray(value) && value.some((v) => !isEmail(v))) next[f.slug] = "One of those emails doesn’t look right.";
    }
    const checked = checkBooking({ eventTypeId: type.id, start, name, email, timeZone, notes, guests, responses: answers });
    const all = { ...next, ...(checked.ok ? {} : checked.errors) };
    setErrors(all);
    if (!checked.ok || Object.keys(all).length) {
      setProblem("Please fix the highlighted fields.");
      return;
    }
    setProblem("");
    setBusy(true);
    try {
      const booked = await sendBooking({ ...checked.value, ...(business ? { business } : {}) });
      void invalidateCal(queryClient);
      onBooked(booked);
    } catch (error) {
      setProblem(messageOf(error));
      if (error instanceof CalRequestError && error.code === "SLOT_TAKEN") onSlotTaken();
    } finally {
      setBusy(false);
    }
  };
  return (
    <form noValidate aria-label="Your details" className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <FormField label="Your name" required error={errors.name}>
        {(p) => <input {...p} className="twc-input" autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}
      </FormField>
      <FormField label="Email" required error={errors.email}>
        {(p) => <input {...p} type="email" className="twc-input" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />}
      </FormField>
      {type.fields.map((f) => (
        <CustomField key={f.slug} field={f} value={answers[f.slug]} error={errors[f.slug]} onChange={(value) => setAnswers((a) => ({ ...a, [f.slug]: value }))} />
      ))}
      <FormField label="Notes" error={errors.notes}>
        {(p) => <textarea {...p} className="twc-input" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </FormField>
      {type.guestsAllowed && <GuestFields guests={guests} onChange={setGuests} error={errors.guests} />}
      <p role="status" aria-live="polite" className={problem ? "twc-error" : "sr-only"}>{busy ? "Booking…" : problem}</p>
      <button type="submit" className="twc-btn w-fit" disabled={busy}>{busy ? "Booking…" : "Confirm booking"}</button>
    </form>
  );
}

/** The whole /book/<type> flow: pick a time, then your details. */
export function BookingFlow({ type, business }: { type: PublicEventType; business?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [timeZone, setTimeZone] = React.useState("America/New_York");
  React.useEffect(() => setTimeZone(browserTimeZone()), []);
  const [slot, setSlot] = React.useState<string | null>(null);
  const [taken, setTaken] = React.useState(false);
  const form = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (slot) form.current?.scrollIntoView?.({ block: "nearest" }); }, [slot]);
  return (
    <div className="flex flex-col gap-8">
      <BookingSummary title={type.title} lengthInMinutes={type.lengthInMinutes} start={slot} timeZone={timeZone} />
      {taken && <p role="alert" className="twc-notice twc-notice--danger">That time was just taken. Please pick another.</p>}
      <SlotChooser eventTypeId={type.id} timeZone={timeZone} onTimeZone={setTimeZone} slot={slot} onSlot={(s) => { setSlot(s); if (s) setTaken(false); }} business={business} />
      {slot && (
        <div ref={form} className="max-w-140">
          <h2 className="twc-h3 mb-4">Your details</h2>
          <BookingForm
            type={type} start={slot} timeZone={timeZone} business={business}
            onSlotTaken={() => { setSlot(null); setTaken(true); void queryClient.invalidateQueries({ queryKey: ["cal", "slots"] }); }}
            onBooked={({ uid, seatUid }) => void navigate({
              to: "/booking/$uid", params: { uid },
              search: { ...(seatUid ? { seat: seatUid } : {}), confirmed: 1, ...(business ? { business } : {}) },
            })}
          />
        </div>
      )}
    </div>
  );
}

export function BookingConfirmation({ booking }: { booking: PublicBooking }) {
  return (
    <div role="status" className="flex flex-col gap-3 border-t border-sb-ink bg-sb-lime p-5">
      <p className="font-display text-[32px] font-extrabold leading-none [font-stretch:75%]">You’re booked.</p>
      <p>We’ve emailed you the details. This page is your private link to change or cancel, so keep it to yourself.</p>
      <AddToCalendar entry={{ uid: booking.uid, title: booking.title, location: booking.location, startTime: booking.start, endTime: booking.end }} />
    </div>
  );
}

const STATUS_KIND = { accepted: "accepted", pending: "pending", cancelled: "cancelled", rejected: "rejected" } as const;

export function ManageBooking({ booking, business, moved, onChanged }: { booking: PublicBooking; business?: string; moved?: boolean; onChanged: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [panel, setPanel] = React.useState<"none" | "reschedule" | "guests">("none");
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [timeZone, setTimeZone] = React.useState(booking.timeZone);
  const [slot, setSlot] = React.useState<string | null>(null);
  const [guests, setGuests] = React.useState<string[]>([""]);
  const [problem, setProblem] = React.useState("");
  const [done, setDone] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  // A move opens a new uid, so this component starts afresh: the address carries the news, and this announces it.
  React.useEffect(() => { if (moved && booking.status !== "cancelled") setDone("Your booking has moved."); }, [moved, booking.status]);
  const base = { ...(booking.seatUid ? { seatUid: booking.seatUid } : {}), ...(business ? { business } : {}) };
  const run = async (body: object, after: (result: { uid: string; seatUid: string | null }) => void) => {
    setBusy(true);
    setProblem("");
    setDone("");
    try {
      const result = await manageBooking(booking.uid, { ...base, ...body });
      await invalidateCal(queryClient);
      after(result);
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setBusy(false);
    }
  };
  const cancelled = booking.status === "cancelled" || booking.status === "rejected";
  const ended = Date.parse(booking.end) <= Date.now();
  const kind = STATUS_KIND[booking.status as keyof typeof STATUS_KIND];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {kind && <StatusBadge kind={kind} />}
        {ended && !cancelled && <StatusBadge kind="ended" />}
      </div>
      <BookingSummary title={booking.title} lengthInMinutes={booking.duration} start={booking.start} end={booking.end} timeZone={booking.timeZone} />
      <dl className="flex flex-col gap-1 text-sm">
        {booking.attendeeName && <div className="flex gap-2"><dt className="font-medium">Booked by</dt><dd>{booking.attendeeName}</dd></div>}
        {booking.hostName && <div className="flex gap-2"><dt className="font-medium">With</dt><dd>{booking.hostName}</dd></div>}
        {booking.location && <div className="flex gap-2"><dt className="font-medium">Where</dt><dd className="min-w-0 break-words">{booking.location}</dd></div>}
      </dl>
      <p role="status" aria-live="polite" className={done ? "twc-notice twc-notice--mint" : "sr-only"}>{done}</p>
      {problem && <p role="alert" className="twc-notice twc-notice--danger">{problem}</p>}
      {cancelled ? <p>This booking has been cancelled.</p> : ended ? <p>This appointment has passed.</p> : (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" aria-expanded={panel === "reschedule"} onClick={() => setPanel(panel === "reschedule" ? "none" : "reschedule")}>Reschedule</button>
            {booking.guestsAllowed && <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" aria-expanded={panel === "guests"} onClick={() => setPanel(panel === "guests" ? "none" : "guests")}>Add guests</button>}
            <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" onClick={() => setConfirmCancel(true)}>Cancel booking</button>
          </div>
          {panel === "reschedule" && (
            <section aria-label="Reschedule" className="flex flex-col gap-4">
              <SlotChooser eventTypeId={booking.eventTypeId} timeZone={timeZone} onTimeZone={setTimeZone} slot={slot} onSlot={setSlot} bookingUid={booking.uid} business={business} />
              <button
                type="button" className="twc-btn w-fit" disabled={!slot || busy}
                onClick={() => void run({ action: "reschedule", start: slot }, ({ uid, seatUid }) => void navigate({
                  to: "/booking/$uid", params: { uid }, search: { ...(seatUid ? { seat: seatUid } : {}), moved: 1, ...(business ? { business } : {}) }, replace: true,
                }).then(() => { setPanel("none"); setSlot(null); setDone("Your booking has moved."); }))}
              >{busy ? "Moving…" : "Move my booking"}</button>
            </section>
          )}
          {panel === "guests" && (
            <section aria-label="Add guests" className="flex max-w-140 flex-col gap-4">
              <GuestFields guests={guests} onChange={setGuests} />
              <button
                type="button" className="twc-btn w-fit" disabled={busy}
                onClick={() => {
                  const emails = guests.map((g) => g.trim().toLowerCase()).filter(Boolean);
                  if (!emails.length || emails.some((g) => !isEmail(g))) return setProblem("Please enter valid guest emails.");
                  return void run({ action: "guests", guests: emails }, () => { setGuests([""]); setPanel("none"); setDone("Your guests have been added."); onChanged(); });
                }}
              >{busy ? "Adding…" : "Add guests"}</button>
            </section>
          )}
        </>
      )}
      <ConfirmDialog
        open={confirmCancel} title="Cancel this booking?" confirmLabel="Cancel booking" cancelLabel="Keep it" danger busy={busy}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => void run({ action: "cancel", reason }, () => { setConfirmCancel(false); setDone("Your booking is cancelled."); onChanged(); })}
      >
        <FormField label="Reason (optional)">
          {(p) => <textarea {...p} className="twc-input" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </FormField>
      </ConfirmDialog>
    </div>
  );
}
