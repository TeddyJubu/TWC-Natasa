import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, FormField, FormNotice, Input, Select } from "@/index";
import { bookingQuery } from "@/features/events/queries";
import { useBookHeadshot } from "@/features/events/mutations";
import { localDateISO } from "@/features/events/format";
import { errorMessage } from "./helpers";
import { InlineError } from "./shared";

/** What the member sees for each headshot booking status (the database allows only these three). */
const BOOKING_COPY: Record<string, { title: string; body: string }> = {
  requested: { title: "Request received", body: "We’ll confirm it here once it’s scheduled." },
  confirmed: { title: "Session confirmed", body: "See you then. Changing it sends it back for confirmation." },
  declined: { title: "We couldn’t fit this one in", body: "Please choose another date." },
};
const bookingCopy = (status: string) => BOOKING_COPY[status] ?? BOOKING_COPY.requested;

/** 02 — her headshot session: the current request’s status, or the form to make or change one. Approved members only. */
export function HeadshotBooking({ userId }: { userId: string }) {
  const bookingState = useQuery(bookingQuery(userId));
  const book = useBookHeadshot(userId);
  const [changingBooking, setChangingBooking] = React.useState(false);
  const booking = changingBooking ? null : bookingState.data ?? null;

  function bookHeadshot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    book.mutate(
      { preferred_date: String(f.get("date")), preferred_time: String(f.get("time")), notes: String(f.get("notes") ?? "") },
      { onSuccess: () => setChangingBooking(false) },
    );
  }

  return (
    <div className="rounded-panel border border-line p-7">
      <Badge variant="solid">Headshot session</Badge>
      <h3 className="mt-5 font-display text-3xl">Your Portrait, Professionally Done</h3>
      {bookingState.isError ? (
        <div className="mt-6"><InlineError message="We couldn’t load your headshot request." onRetry={() => void bookingState.refetch()} /></div>
      ) : booking ? (
        <FormNotice className="mt-6" title={bookingCopy(booking.status).title} tone={booking.status === "confirmed" ? "accent" : "soft"}>
          {new Date(booking.preferred_date + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {booking.preferred_time}. {bookingCopy(booking.status).body}
          <button type="button" className="mt-3 block underline underline-offset-4" onClick={() => { book.reset(); setChangingBooking(true); }}>Change request</button>
        </FormNotice>
      ) : (
        <form onSubmit={bookHeadshot} className="mt-6 flex flex-col gap-6">
          <FormField label="Preferred date" htmlFor="date"><Input name="date" type="date" required min={localDateISO()} /></FormField>
          <FormField label="Time of day" htmlFor="time"><Select name="time"><option>Morning</option><option>Afternoon</option><option>Evening</option></Select></FormField>
          <FormField label="Notes" htmlFor="notes" optional><Input name="notes" maxLength={300} placeholder="Bringing products, a team…" /></FormField>
          {book.isError && <p role="alert" className="text-sm text-danger">{errorMessage(book.error)}</p>}
          <Button type="submit" variant="white" disabled={book.isPending}>Request my session</Button>
        </form>
      )}
    </div>
  );
}
