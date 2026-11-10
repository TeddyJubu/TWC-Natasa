import * as React from "react";
import { cn } from "@/index";
import { useQuery } from "@tanstack/react-query";
import { bookingQuery } from "@/features/events/queries";
import { useBookHeadshot } from "@/features/events/mutations";
import { localDateISO } from "@/features/events/format";
import { fieldClass, linkClass, primaryButton } from "@/app/layout/app-classes";
import { Card, InlineError, Row } from "@/app/layout/app-ui";
import { errorMessage } from "./helpers";
import { Locked } from "./shared";

/** What the member sees for each headshot booking status (the database allows only these three). */
const BOOKING_COPY: Record<string, { title: string; body: string; notice: string }> = {
  requested: { title: "Request received", body: "We’ll confirm it here once it’s scheduled.", notice: "twc-notice" },
  confirmed: { title: "Session confirmed", body: "See you then. Changing it sends it back for confirmation.", notice: "twc-notice twc-notice--mint" },
  declined: { title: "We couldn’t fit this one in", body: "Please choose another date.", notice: "twc-notice twc-notice--danger" },
};
const bookingCopy = (status: string) => BOOKING_COPY[status] ?? BOOKING_COPY.requested;
const longDate = (iso: string) => new Date(iso + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

const DATE_ID = "headshot-date";
const NOTES_ID = "headshot-notes";

/** Her headshot session: the current request's status, or the request rows (values until an Add opens them). */
export function HeadshotBooking({ userId, approved, applied }: { userId: string; approved: boolean; applied: boolean }) {
  return (
    <Card id="headshot" title="Headshot session" subtitle="Included with your membership — your portrait, professionally done">
      {approved ? <Booking userId={userId} /> : <Locked applied={applied} />}
    </Card>
  );
}

function Booking({ userId }: { userId: string }) {
  const bookingState = useQuery(bookingQuery(userId));
  const book = useBookHeadshot(userId);
  const [changing, setChanging] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [focus, setFocus] = React.useState<string | null>(null);
  const [request, setRequest] = React.useState({ preferred_date: "", preferred_time: "Morning", notes: "" });
  const booking = changing ? null : bookingState.data ?? null;

  React.useLayoutEffect(() => {
    if (focus) document.getElementById(focus)?.focus();
    setFocus(null);
  }, [focus]);

  const open = (id: string) => { setEditing(true); setFocus(id); };

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!request.preferred_date) return open(DATE_ID);
    book.mutate(request, { onSuccess: () => { setChanging(false); setEditing(false); } });
  }

  if (bookingState.isError) return <InlineError message="We couldn’t load your headshot request." onRetry={() => void bookingState.refetch()} />;

  if (booking) {
    const copy = bookingCopy(booking.status);
    return (
      <div className="p-2">
      <div className={cn(copy.notice, "items-start")}>
        <p className="twc-notice__title">{copy.title}</p>
        <p className="text-[15px] text-ink">{longDate(booking.preferred_date)} · {booking.preferred_time}. {copy.body}</p>
        <button
          // Ink, not blue: blue ink misses AA on the mint and rose notices.
          type="button" className={cn(linkClass, "text-ink")}
          onClick={() => {
            book.reset();
            setRequest({ preferred_date: booking.preferred_date, preferred_time: booking.preferred_time, notes: booking.notes ?? "" });
            setChanging(true);
            open(DATE_ID);
          }}
        >
          Change request
        </button>
      </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="divide-y divide-app-rule">
      <Row
        label="Preferred date" htmlFor={editing ? DATE_ID : undefined} icon="calendar" empty={!editing && !request.preferred_date}
        add={editing ? undefined : { field: "preferred date", onClick: () => open(DATE_ID) }}
      >
        {editing
          ? <input id={DATE_ID} type="date" required min={localDateISO()} value={request.preferred_date} className={fieldClass} onChange={(e) => setRequest({ ...request, preferred_date: e.currentTarget.value })} />
          : request.preferred_date ? longDate(request.preferred_date) : "Choose a date"}
      </Row>
      <Row label="Time of day" htmlFor={editing ? "headshot-time" : undefined} icon="sun">
        {editing ? (
          <select id="headshot-time" value={request.preferred_time} className={fieldClass} onChange={(e) => setRequest({ ...request, preferred_time: e.currentTarget.value })}>
            <option>Morning</option><option>Afternoon</option><option>Evening</option>
          </select>
        ) : request.preferred_time}
      </Row>
      <Row
        label="Notes" htmlFor={editing ? NOTES_ID : undefined} icon="notebook-pen" empty={!editing && !request.notes}
        add={editing ? undefined : { field: "notes", onClick: () => open(NOTES_ID) }}
      >
        {editing
          ? <input id={NOTES_ID} maxLength={300} placeholder="Bringing products, a team…" value={request.notes} className={fieldClass} onChange={(e) => setRequest({ ...request, notes: e.currentTarget.value })} />
          : request.notes || "Bringing products, a team…"}
      </Row>
      <div className="flex flex-wrap items-center justify-end gap-4 px-4 py-4 sm:px-5.5">
        {book.isError && <p role="alert" className="mr-auto text-sm text-danger">{errorMessage(book.error)}</p>}
        <button type="submit" disabled={book.isPending} className={primaryButton}>{book.isPending ? "Sending…" : <>Request my session <span aria-hidden className="twc-arrow">→</span></>}</button>
      </div>
    </form>
  );
}
