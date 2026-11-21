// The admin side of Cal, on the airmail kit. Every call is checked again by requireAdmin in cal.server.ts.
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { cn } from "@/index";
import { fieldClass, linkClass, primaryButton, redButton, secondaryButton } from "@/app/layout/app-classes";
import { Card, Chip, EmptySlot, InlineError, Toggle, type ChipTone } from "@/app/layout/app-ui";
import { rsvpCsv, rsvpTotals, STATUS_LABEL, useAdminBusiness } from "./admin-state";
import { addCalRsvpFn, cancelCalEventFn, saveCalEventFn, saveCalEventTypeFn } from "./fns";
import {
  adminBusinessesQuery, adminCalBookingsQuery, adminCalEventsQuery, adminCalEventTypesQuery, adminCalRsvpsQuery, invalidateCal,
} from "./queries";
import { formatRange, isoToWall, timeZones, wallToIso } from "./time";
import {
  checkEvent, checkEventType, checkRsvp, MAX_PLUS_ONES, RSVP_STATUSES, slugify,
  type AdminCalEvent, type BookingStatusFilter, type EditableEventType, type EventTab, type OwnerRsvp, type RsvpStatus,
} from "./types";
import { ConfirmDialog, FormField, useToast } from "./ui";

const messageOf = (error: unknown) => (error as Error | null)?.message || "Something went wrong. Please try again.";

export function BusinessSwitcher({ value, onChange }: { value?: string; onChange: (business?: string) => void }) {
  const names = useQuery({ ...adminBusinessesQuery, retry: false });
  if (!names.data || names.data.length < 2) return null;
  return (
    <FormField label="Business" className="max-w-70">
      {(p) => (
        <select {...p} className={fieldClass} value={value ?? names.data[0]} onChange={(e) => onChange(e.target.value)}>
          {names.data.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      )}
    </FormField>
  );
}

export function PublicLinkCopy({ slug }: { slug: string }) {
  const { toast, toastNode } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/gatherings/${encodeURIComponent(slug)}`);
      toast("Link copied");
    } catch {
      toast("Couldn’t copy. The link is on the gathering’s public page.");
    }
  };
  return <><button type="button" className={cn(secondaryButton, "whitespace-nowrap")} onClick={() => void copy()}>Copy link</button>{toastNode}</>;
}

const eventChip = (e: AdminCalEvent): [ChipTone, string] =>
  e.status === "CANCELLED" ? ["no", "Cancelled"] : Date.parse(e.endTime) <= Date.now() ? ["muted", "Ended"]
    : e.capacity !== null && (e.spotsLeft ?? 1) <= 0 ? ["pending", "Full"] : ["ok", "Scheduled"];

export function AdminEventsTable({ events, caption }: { events: AdminCalEvent[]; caption: string }) {
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-app-accent">
      <table className="w-full min-w-[46rem] text-left text-[15px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-app-rule">
            {["Gathering", "When", "Status", "Going", "Maybe"].map((h) => <th key={h} scope="col" className="air-lbl px-4 py-2.5">{h}</th>)}
            <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const [tone, label] = eventChip(e);
            return (
              <tr key={e.uid} className="border-b border-app-rule align-middle last:border-0">
                <th scope="row" className="min-w-52 px-4 py-3 font-normal">
                  <Link to="/admin/gatherings/$uid" params={{ uid: e.uid }} className="font-gilda text-lg text-ink underline-offset-2 hover:underline">{e.title}</Link>
                  {e.hidden && <span className="ml-2 align-middle"><Chip>Unlisted</Chip></span>}
                  {e.category && <span className="block text-sm text-app-muted">{e.category}</span>}
                </th>
                <td className="px-4 py-3 text-sm">{formatRange(e.startTime, e.endTime, e.timeZone, "en-US")}</td>
                <td className="px-4 py-3"><Chip tone={tone}>{label}</Chip></td>
                <td className="px-4 py-3 font-fragment tabular-nums">{e.goingCount}{e.capacity !== null ? ` / ${e.capacity}` : ""}</td>
                <td className="px-4 py-3 font-fragment tabular-nums">{e.maybeCount}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link to="/admin/gatherings/$uid" params={{ uid: e.uid }} className={cn(secondaryButton, "whitespace-nowrap")} aria-label={`Open ${e.title}`}>Open</Link>
                    <PublicLinkCopy slug={e.slug} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** /admin/gatherings. Cal being down shows here and nowhere else. */
export function GatheringsPanel() {
  const [business, setBusiness] = useAdminBusiness();
  const [tab, setTab] = React.useState<EventTab>("upcoming");
  const [skip, setSkip] = React.useState(0);
  const events = useQuery({ ...adminCalEventsQuery({ tab, skip, ...(business ? { business } : {}) }), retry: false });
  const pick = (next: EventTab) => { setTab(next); setSkip(0); };
  const total = events.data?.total ?? 0;
  return (
    <Card
      id="gatherings" title="Gatherings" subtitle="Everything on the calendar"
      action={<Link to="/admin/gatherings/new" className={cn(primaryButton, "shrink-0")}>New gathering</Link>}
    >
      <div className="flex flex-wrap items-end justify-between gap-4 px-4 py-3">
        <div role="group" aria-label="Which gatherings" className="flex gap-2">
          {(["upcoming", "past"] as const).map((t) => <button key={t} type="button" aria-pressed={tab === t} className="air-filter" onClick={() => pick(t)}>{t === "upcoming" ? "Upcoming" : "Past"}</button>)}
        </div>
        <BusinessSwitcher value={business} onChange={(b) => { setBusiness(b); setSkip(0); }} />
      </div>
      {events.isError ? <div className="p-4"><InlineError message={`The calendar isn’t responding. ${messageOf(events.error)}`} onRetry={() => void events.refetch()} /></div>
        : events.isPending ? <p role="status" className="p-4 text-sm text-app-muted">Loading gatherings…</p>
        : !events.data.events.length ? <div className="p-4"><EmptySlot icon="calendar-days">{tab === "upcoming" ? "Nothing on the calendar yet. Add the first gathering." : "No past gatherings yet."}</EmptySlot></div>
        : <AdminEventsTable events={events.data.events} caption={tab === "upcoming" ? "Upcoming gatherings" : "Past gatherings"} />}
      {total > 25 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <button type="button" className={secondaryButton} disabled={skip === 0} onClick={() => setSkip(Math.max(skip - 25, 0))}>Newer page</button>
          <span>{skip + 1}–{Math.min(skip + 25, total)} of {total}</span>
          <button type="button" className={secondaryButton} disabled={skip + 25 >= total} onClick={() => setSkip(skip + 25)}>Next page</button>
        </div>
      )}
    </Card>
  );
}

export function EventEditorForm({ event, business }: { event?: AdminCalEvent; business?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast, toastNode } = useToast();
  const zone = event?.timeZone ?? "America/New_York";
  const [d, setD] = React.useState({
    title: event?.title ?? "", slug: event?.slug ?? "", description: event?.description ?? "", category: event?.category ?? "",
    coverImageUrl: event?.coverImageUrl ?? "", location: event?.location ?? "", timeZone: zone,
    start: event ? isoToWall(event.startTime, zone) : "", end: event ? isoToWall(event.endTime, zone) : "",
    capacity: event?.capacity === null || event?.capacity === undefined ? "" : String(event.capacity),
    hidden: event?.hidden ?? false, showAttendees: event?.showAttendees ?? true,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const zones = React.useMemo(() => timeZones(d.timeZone), [d.timeZone]);
  const set = <K extends keyof typeof d>(key: K, value: (typeof d)[K]) => setD((v) => ({ ...v, [key]: value }));
  const save = useMutation({
    mutationFn: (body: unknown) => saveCalEventFn({ data: { ...(event ? { uid: event.uid } : {}), event: body, ...(business ? { business } : {}) } }),
    onSuccess: async (saved) => {
      await invalidateCal(queryClient);
      toast("Saved");
      if (!event) void navigate({ to: "/admin/gatherings/$uid", params: { uid: saved.uid } });
    },
  });
  const submit = () => {
    const raw = {
      title: d.title, slug: d.slug, description: d.description, category: d.category, coverImageUrl: d.coverImageUrl, location: d.location,
      timeZone: d.timeZone, capacity: d.capacity, hidden: d.hidden, showAttendees: d.showAttendees,
      startTime: wallToIso(d.start, d.timeZone) ?? "", endTime: wallToIso(d.end, d.timeZone) ?? "",
    };
    const checked = checkEvent(raw);
    if (!checked.ok) return setErrors(checked.errors);
    setErrors({});
    return save.mutate(checked.value);
  };
  const text = (key: "title" | "slug" | "category" | "coverImageUrl" | "location", label: string, hint?: string, required?: boolean) => (
    <FormField label={label} hint={hint} error={errors[key]} required={required}>
      {(p) => <input {...p} className={fieldClass} value={d[key]} onChange={(e) => set(key, e.target.value)} />}
    </FormField>
  );
  return (
    <form noValidate aria-label={event ? `Edit ${event.title}` : "New gathering"} className="flex flex-col gap-5 p-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      {text("title", "Title", undefined, true)}
      {text("slug", "Web address", d.slug ? `/gatherings/${slugify(d.slug)}` : "Made from the title when left blank.")}
      <FormField label="Description" hint="Plain text. Line breaks are kept." error={errors.description}>
        {(p) => <textarea {...p} className={fieldClass} maxLength={10_000} value={d.description} onChange={(e) => set("description", e.target.value)} />}
      </FormField>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField label="Starts" required error={errors.startTime}>
          {(p) => <input {...p} type="datetime-local" className={fieldClass} value={d.start} onChange={(e) => set("start", e.target.value)} />}
        </FormField>
        <FormField label="Ends" required error={errors.endTime}>
          {(p) => <input {...p} type="datetime-local" className={fieldClass} value={d.end} onChange={(e) => set("end", e.target.value)} />}
        </FormField>
      </div>
      <FormField label="Time zone" hint="The times above are read in this zone." error={errors.timeZone}>
        {(p) => <select {...p} className={fieldClass} value={d.timeZone} onChange={(e) => set("timeZone", e.target.value)}>{zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}</select>}
      </FormField>
      {text("location", "Location")}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {text("category", "Category")}
        <FormField label="Capacity" hint="Blank means unlimited." error={errors.capacity}>
          {(p) => <input {...p} type="number" min={1} className={fieldClass} value={d.capacity} onChange={(e) => set("capacity", e.target.value)} />}
        </FormField>
      </div>
      {text("coverImageUrl", "Cover image address", "An https:// image link.")}
      <Toggle label="Unlisted" description="Left out of lists and search; anyone with the link can still open it." checked={d.hidden} onChange={(e) => set("hidden", e.target.checked)} />
      <Toggle label="Show who’s coming" description="First names on the public page." checked={d.showAttendees} onChange={(e) => set("showAttendees", e.target.checked)} />
      {save.isError && <p role="alert" className="twc-error">{messageOf(save.error)}</p>}
      <button type="submit" className={cn(redButton, "w-fit")} disabled={save.isPending}>{save.isPending ? "Saving…" : event ? "Save changes" : "Create gathering"}</button>
      {toastNode}
    </form>
  );
}

export function CancelEventDialog({ event, business }: { event: AdminCalEvent; business?: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const cancel = useMutation({
    mutationFn: () => cancelCalEventFn({ data: { uid: event.uid, ...(business ? { business } : {}) } }),
    onSuccess: async () => { await invalidateCal(queryClient); setOpen(false); },
  });
  if (event.status === "CANCELLED") return null;
  return (
    <>
      <button type="button" className={secondaryButton} onClick={() => setOpen(true)}>Cancel gathering</button>
      <ConfirmDialog
        open={open} title={`Cancel ${event.title}?`} confirmLabel="Cancel gathering" cancelLabel="Keep it" danger busy={cancel.isPending}
        onClose={() => setOpen(false)} onConfirm={() => cancel.mutate()}
      >
        <p>It stays on the calendar marked cancelled, and no one can RSVP. {event.goingCount} {event.goingCount === 1 ? "person is" : "people are"} going.</p>
        {cancel.isError && <p role="alert" className="twc-error">{messageOf(cancel.error)}</p>}
      </ConfirmDialog>
    </>
  );
}

const STATUS_TONE: Record<RsvpStatus, ChipTone> = { GOING: "ok", MAYBE: "pending", NOT_GOING: "muted" };

export function AddRsvpDialog({ event, business }: { event: AdminCalEvent; business?: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState({ name: "", email: "", status: "GOING" as RsvpStatus, plusOnes: "0", note: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const add = useMutation({
    mutationFn: (rsvp: unknown) => addCalRsvpFn({ data: { uid: event.uid, rsvp, ...(business ? { business } : {}) } }),
    onSuccess: async () => {
      await invalidateCal(queryClient);
      setOpen(false);
      setV({ name: "", email: "", status: "GOING", plusOnes: "0", note: "" });
    },
  });
  const submit = () => {
    const checked = checkRsvp({ ...v, plusOnes: Number(v.plusOnes) });
    if (!checked.ok) return setErrors(checked.errors);
    setErrors({});
    return add.mutate(checked.value);
  };
  return (
    <>
      <button type="button" className={primaryButton} onClick={() => setOpen(true)}>Add an RSVP</button>
      <ConfirmDialog open={open} title="Add an RSVP" confirmLabel="Add RSVP" cancelLabel="Close" busy={add.isPending} onClose={() => setOpen(false)} onConfirm={submit}>
        <p className="text-sm">An email that already answered is updated.</p>
        <FormField label="Name" required error={errors.name}>{(p) => <input {...p} className={fieldClass} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}</FormField>
        <FormField label="Email" required error={errors.email}>{(p) => <input {...p} type="email" className={fieldClass} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />}</FormField>
        <FormField label="Answer">
          {(p) => <select {...p} className={fieldClass} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as RsvpStatus })}>{RSVP_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>}
        </FormField>
        <FormField label="Guests" error={errors.plusOnes}>{(p) => <input {...p} type="number" min={0} max={MAX_PLUS_ONES} className={fieldClass} value={v.plusOnes} onChange={(e) => setV({ ...v, plusOnes: e.target.value })} />}</FormField>
        <FormField label="Note" error={errors.note}>{(p) => <textarea {...p} className={fieldClass} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />}</FormField>
        {add.isError && <p role="alert" className="twc-error">{messageOf(add.error)}</p>}
      </ConfirmDialog>
    </>
  );
}

export function RsvpTable({ event, business }: { event: AdminCalEvent; business?: string }) {
  const rsvps = useQuery({ ...adminCalRsvpsQuery(event.uid, business), retry: false });
  const [filter, setFilter] = React.useState<RsvpStatus | "ALL">("ALL");
  const rows = rsvps.data ?? [];
  const shown = filter === "ALL" ? rows : rows.filter((r) => r.status === filter);
  const totals = rsvpTotals(rows);
  const download = () => {
    const url = URL.createObjectURL(new Blob([rsvpCsv(shown)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event.slug}-rsvps.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Card
      title="RSVPs" subtitle={`${totals.going} going${totals.guests ? ` + ${totals.guests} guests = ${totals.seats} seats` : ""} · ${totals.maybe} maybe · ${totals.notGoing} can’t go`}
      action={<AddRsvpDialog event={event} business={business} />}
    >
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-3">
        <FormField label="Show" className="max-w-50">
          {(p) => (
            <select {...p} className={fieldClass} value={filter} onChange={(e) => setFilter(e.target.value as RsvpStatus | "ALL")}>
              <option value="ALL">Everyone ({rows.length})</option>
              {RSVP_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          )}
        </FormField>
        <button type="button" className={secondaryButton} disabled={!shown.length} onClick={download}>Download CSV</button>
      </div>
      {rsvps.isError ? <div className="p-4"><InlineError message={messageOf(rsvps.error)} onRetry={() => void rsvps.refetch()} /></div>
        : rsvps.isPending ? <p role="status" className="p-4 text-sm text-app-muted">Loading RSVPs…</p>
        : !shown.length ? <div className="p-4"><EmptySlot>No RSVPs here yet.</EmptySlot></div>
        : (
          <div role="region" aria-label="RSVP list" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-app-accent">
            <table className="w-full min-w-[40rem] text-left text-[15px]">
              <caption className="sr-only">RSVPs for {event.title}</caption>
              <thead><tr className="border-b border-app-rule">{["Name", "Email", "Answer", "Guests", "Note"].map((h) => <th key={h} scope="col" className="air-lbl px-4 py-2.5">{h}</th>)}</tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.uid} className="border-b border-app-rule last:border-0">
                    <th scope="row" className="px-4 py-2.5 font-medium">{r.name}</th>
                    <td className="px-4 py-2.5"><a className={linkClass} href={`mailto:${encodeURIComponent(r.email)}`}>{r.email}</a></td>
                    <td className="px-4 py-2.5"><Chip tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Chip></td>
                    <td className="px-4 py-2.5 tabular-nums">{r.plusOnes}</td>
                    <td className="max-w-70 px-4 py-2.5 text-sm break-words whitespace-pre-line">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </Card>
  );
}

const BOOKING_TABS: { id: BookingStatusFilter; label: string }[] = [
  { id: "upcoming", label: "Upcoming" }, { id: "unconfirmed", label: "Unconfirmed" }, { id: "past", label: "Past" }, { id: "cancelled", label: "Cancelled" },
];

export function AdminBookingsTable({ business }: { business?: string }) {
  const [status, setStatus] = React.useState<BookingStatusFilter>("upcoming");
  const [skip, setSkip] = React.useState(0);
  const bookings = useQuery({ ...adminCalBookingsQuery({ status, skip, ...(business ? { business } : {}) }), retry: false });
  return (
    <Card title="Bookings" subtitle="Who has booked an appointment">
      <div role="group" aria-label="Which bookings" className="flex flex-wrap gap-2 px-4 py-3">
        {BOOKING_TABS.map((t) => <button key={t.id} type="button" aria-pressed={status === t.id} className="air-filter" onClick={() => { setStatus(t.id); setSkip(0); }}>{t.label}</button>)}
      </div>
      {bookings.isError ? <div className="p-4"><InlineError message={messageOf(bookings.error)} onRetry={() => void bookings.refetch()} /></div>
        : bookings.isPending ? <p role="status" className="p-4 text-sm text-app-muted">Loading bookings…</p>
        : !bookings.data.bookings.length ? <div className="p-4"><EmptySlot icon="calendar">Nothing here.</EmptySlot></div>
        : (
          <div role="region" aria-label="Bookings" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-app-accent">
            <table className="w-full min-w-[44rem] text-left text-[15px]">
              <caption className="sr-only">Bookings</caption>
              <thead><tr className="border-b border-app-rule">{["Appointment", "When", "Who", "Status"].map((h) => <th key={h} scope="col" className="air-lbl px-4 py-2.5">{h}</th>)}</tr></thead>
              <tbody>
                {bookings.data.bookings.map((b) => (
                  <tr key={b.uid} className="border-b border-app-rule align-top last:border-0">
                    <th scope="row" className="px-4 py-3 font-normal"><span className="font-gilda text-lg">{b.title}</span>{b.location && <span className="block text-sm break-words text-app-muted">{b.location}</span>}</th>
                    <td className="px-4 py-3 text-sm">{formatRange(b.start, b.end, b.attendees[0]?.timeZone || "America/New_York", "en-US")}</td>
                    <td className="px-4 py-3 text-sm">
                      {b.attendees.map((a) => <span key={a.email} className="block">{a.name} · <a className={linkClass} href={`mailto:${encodeURIComponent(a.email)}`}>{a.email}</a>{a.notes ? <span className="block text-app-muted">{a.notes}</span> : null}</span>)}
                      {b.guests.length > 0 && <span className="block text-app-muted">Guests: {b.guests.join(", ")}</span>}
                    </td>
                    <td className="px-4 py-3"><Chip tone={b.status === "accepted" ? "ok" : b.status === "cancelled" || b.status === "rejected" ? "no" : "pending"}>{b.status}</Chip>{b.cancellationReason && <span className="mt-1 block text-sm text-app-muted">{b.cancellationReason}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {(skip > 0 || bookings.data?.hasMore) && (
        <div className="flex justify-between gap-3 px-4 py-3">
          <button type="button" className={secondaryButton} disabled={skip === 0} onClick={() => setSkip(Math.max(skip - 25, 0))}>Previous</button>
          <button type="button" className={secondaryButton} disabled={!bookings.data?.hasMore} onClick={() => setSkip(skip + 25)}>Next</button>
        </div>
      )}
    </Card>
  );
}

export function EventTypeEditor({ type, business, onDone }: { type?: EditableEventType; business?: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [v, setV] = React.useState({
    title: type?.title ?? "", slug: type?.slug ?? "", description: type?.description ?? "", lengthInMinutes: String(type?.lengthInMinutes ?? 30),
    seatsPerSlot: type?.seatsPerSlot ? String(type.seatsPerSlot) : "", showAttendeeInfo: type?.showAttendeeInfo ?? false, showAvailabilityCount: type?.showAvailabilityCount ?? true,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (eventType: unknown) => saveCalEventTypeFn({ data: { eventType, ...(business ? { business } : {}) } }),
    onSuccess: async () => { await invalidateCal(queryClient); onDone(); },
  });
  const submit = () => {
    const checked = checkEventType({ ...v, ...(type ? { id: type.id } : {}) });
    if (!checked.ok) return setErrors(checked.errors);
    setErrors({});
    return save.mutate(checked.value);
  };
  return (
    <form noValidate aria-label={type ? `Edit ${type.title}` : "New appointment type"} className="flex flex-col gap-4 border-t border-app-rule p-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <FormField label="Title" required error={errors.title}>{(p) => <input {...p} className={fieldClass} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />}</FormField>
      <FormField label="Web address" hint={`/book/${slugify(v.slug || v.title) || "…"}`} error={errors.slug}>{(p) => <input {...p} className={fieldClass} value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} />}</FormField>
      <FormField label="Description">{(p) => <textarea {...p} className={fieldClass} maxLength={2000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />}</FormField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Length (minutes)" required error={errors.lengthInMinutes}>{(p) => <input {...p} type="number" min={5} max={720} className={fieldClass} value={v.lengthInMinutes} onChange={(e) => setV({ ...v, lengthInMinutes: e.target.value })} />}</FormField>
        <FormField label="Seats per time" hint="Blank for one-to-one." error={errors.seatsPerSlot}>{(p) => <input {...p} type="number" min={1} className={fieldClass} value={v.seatsPerSlot} onChange={(e) => setV({ ...v, seatsPerSlot: e.target.value })} />}</FormField>
      </div>
      {v.seatsPerSlot && <Toggle label="Show seats left" description="Visitors see how many seats remain." checked={v.showAvailabilityCount} onChange={(e) => setV({ ...v, showAvailabilityCount: e.target.checked })} />}
      {save.isError && <p role="alert" className="twc-error">{messageOf(save.error)}</p>}
      <div className="flex gap-2">
        <button type="submit" className={primaryButton} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</button>
        <button type="button" className={secondaryButton} onClick={onDone}>Close</button>
      </div>
    </form>
  );
}

function EventTypesCard({ business }: { business?: string }) {
  const types = useQuery({ ...adminCalEventTypesQuery(business), retry: false });
  const [editing, setEditing] = React.useState<EditableEventType | "new" | null>(null);
  return (
    <Card title="Appointment types" subtitle="What people can book at /book" action={<button type="button" className={primaryButton} onClick={() => setEditing("new")}>New type</button>}>
      {types.isError ? <div className="p-4"><InlineError message={messageOf(types.error)} onRetry={() => void types.refetch()} /></div>
        : types.isPending ? <p role="status" className="p-4 text-sm text-app-muted">Loading…</p>
        : !types.data.length ? <div className="p-4"><EmptySlot icon="calendar">No appointment types yet.</EmptySlot></div>
        : (
          <ul>
            {types.data.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-app-rule px-4 py-3 last:border-0">
                <span className="min-w-0"><span className="font-gilda text-lg">{t.title}</span> <span className="text-sm text-app-muted">/book/{t.slug} · {t.lengthInMinutes} min{t.seatsPerSlot ? ` · ${t.seatsPerSlot} seats` : ""}</span></span>
                <span className="flex items-center gap-2">{t.hidden && <Chip>Hidden</Chip>}<button type="button" className={secondaryButton} aria-label={`Edit ${t.title}`} onClick={() => setEditing(t)}>Edit</button></span>
              </li>
            ))}
          </ul>
        )}
      {editing && <EventTypeEditor key={editing === "new" ? "new" : editing.id} type={editing === "new" ? undefined : editing} business={business} onDone={() => setEditing(null)} />}
    </Card>
  );
}

/** /admin/appointments: Cal bookings and types. The headshot requests keep their own section. */
export function AppointmentsPanel() {
  const [business, setBusiness] = useAdminBusiness();
  return (
    <div id="appointments" className="flex flex-col gap-6">
      <BusinessSwitcher value={business} onChange={setBusiness} />
      <AdminBookingsTable business={business} />
      <EventTypesCard business={business} />
    </div>
  );
}
