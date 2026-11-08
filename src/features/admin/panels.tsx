// The four /admin cards (sidebar anchors). Data and rules live in ./queries, ./mutations and ./format; these only render.
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/index";
import { fieldClass, primaryButton, ring, secondaryButton } from "@/app/layout/app-classes";
import { Card, Chip, InlineError, Toggle } from "@/app/layout/app-ui";
import { Icon } from "@/app/layout/icons";
import { toneFor } from "@/features/neighborhoods/tone";
import {
  adminApplicationsQuery, adminBookingsQuery, adminMembersQuery, adminNeighborhoodsQuery,
  type AdminApplication, type AdminBooking, type AdminMember, type AdminNeighborhood,
} from "./queries";
import {
  LogoNotSavedError, useCreateNeighborhood, useReviewApplication, useSetBookingStatus, useSetMemberStatus, useUpdateNeighborhood,
} from "./mutations";
import type { ApprovalNotice } from "./approval-email";
import { checkLogo, formatAnswers, formatDate, formatDay, humanizeKey, reviewerName, type AnswerEntry } from "./format";

const errorMessage = (error: unknown) =>
  (error as { message?: string } | null)?.message || "Something went wrong. Please try again.";

/** Inline `--hood` for a neighborhood color, consumed via `bg-(--hood)`. */
const hoodStyle = (color: string) => ({ "--hood": color }) as React.CSSProperties;

const meta = "text-[13.5px]/5 text-app-muted";

// ---------- Shared states ----------

/** Loading or failed-before-any-data state; the rows once data is in. A failed refresh keeps the data and shows the error above it. */
type Loadable = { data: unknown; isError: boolean; refetch: () => unknown };

function QueryGate({ query, what, children }: { query: Loadable; what: string; children: React.ReactNode }) {
  const retry = () => void query.refetch();
  if (query.data === undefined) {
    return query.isError
      ? <InlineError message={`We couldn’t load ${what} right now.`} onRetry={retry} />
      : <p role="status" className="px-5.5 py-4 text-sm text-app-muted">Loading {what}…</p>;
  }
  return (
    <>
      {query.isError && <InlineError message={`We couldn’t load the latest ${what} right now.`} onRetry={retry} />}
      {children}
    </>
  );
}

/** Names come from the members list; say so (with Retry) when it fails, rather than guessing. */
function NamesError({ members }: { members: Loadable }) {
  return members.isError ? <InlineError message="We couldn’t load member names right now." onRetry={() => void members.refetch()} /> : null;
}

function MutationError({ mutation }: { mutation: { isError: boolean; error: unknown } }) {
  return mutation.isError ? <p role="alert" className="text-sm text-danger">{errorMessage(mutation.error)}</p> : null;
}

/** After an approval: whether the welcome email went out. */
function EmailNotice({ notice }: { notice: ApprovalNotice | null | undefined }) {
  if (!notice) return null;
  return (
    <p role="status" className="text-sm text-app-muted">
      {notice.sent ? "Welcome email sent" : `Approved — email not sent (${notice.reason})`}
    </p>
  );
}

/** Waiting on an admin (pending, requested) in the accent; settled states muted. */
function StatusChip({ status }: { status: string }) {
  return <Chip tone={status === "pending" || status === "requested" ? "accent" : "muted"}>{humanizeKey(status)}</Chip>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5.5 py-4 text-[15px] text-app-muted">{children}</p>;
}

/** Buttons for every outcome except the current one; all disabled while a change is in flight. */
function Decisions<S extends string>({ current, options, subject, pending, onDecide }: {
  current: string; options: { status: S; label: string }[]; subject: string; pending: boolean; onDecide: (status: S) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.filter((o) => o.status !== current).map((o, i) => (
        <button
          key={o.status}
          type="button"
          className={i === 0 ? primaryButton : secondaryButton}
          aria-label={`${o.label} ${subject}`}
          disabled={pending}
          onClick={() => onDecide(o.status)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A row in a card: name (h3) and details on the left, status on the right, then the rest. */
function Item({ headingId, title, status, details, children }: {
  headingId: string; title: string; status: string; details: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-3.5 px-5.5 py-4.5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id={headingId} className="text-[15px] font-medium break-words text-ink">{title}</h3>
          {details}
        </div>
        <StatusChip status={status} />
      </div>
      {children}
    </article>
  );
}

const REVIEW_OPTIONS = [{ status: "approved" as const, label: "Approve" }, { status: "declined" as const, label: "Decline" }];

// ---------- Applications ----------

export function ApplicationsPanel() {
  const apps = useQuery(adminApplicationsQuery);
  const members = useQuery(adminMembersQuery);
  const list = apps.data ?? [];
  const pending = list.filter((a) => a.status === "pending").length;
  return (
    <Card id="applications" title="Applications" subtitle={apps.data ? `${pending} pending · ${list.length} in total` : "Who has asked to join"}>
      <QueryGate query={apps} what="applications">
        <NamesError members={members} />
        {list.length === 0
          ? <Empty>No applications yet.</Empty>
          : list.map((app) => <ApplicationRow key={app.id} app={app} members={members.data ?? []} />)}
      </QueryGate>
    </Card>
  );
}

function ApplicationRow({ app, members }: { app: AdminApplication; members: AdminMember[] }) {
  const review = useReviewApplication();
  const by = reviewerName(app.reviewed_by, members);
  const answers = formatAnswers(app.answers);
  return (
    <Item
      headingId={`application-${app.id}`} title={app.full_name} status={app.status}
      details={<>
        <p className={cn(meta, "break-words")}>{app.email} · {app.neighborhood || "No neighborhood given"} · Submitted {formatDate(app.created_at)}</p>
        <p className={meta}>{app.user_id ? "Linked to an account" : "No account yet"}</p>
      </>}
    >
      {app.status !== "pending" && (
        <p className={meta}>{humanizeKey(app.status)} {formatDate(app.reviewed_at)}{by && ` by ${by}`}</p>
      )}
      {answers.length > 0 && (
        <details className="group rounded-lg border border-app-line">
          <summary className={cn("flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden", ring)}>
            <Icon name="chevron-down" className="size-3.25 -rotate-90 text-app-muted transition-transform group-open:rotate-0 motion-reduce:transition-none" />
            Answers ({answers.length})
          </summary>
          <AnswerList entries={answers} />
        </details>
      )}
      <MutationError mutation={review} />
      <EmailNotice notice={review.data} />
      <Decisions
        current={app.status}
        options={REVIEW_OPTIONS}
        subject={app.full_name}
        pending={review.isPending}
        onDecide={(status) => review.mutate({ id: app.id, status })}
      />
    </Item>
  );
}

function AnswerList({ entries }: { entries: AnswerEntry[] }) {
  return (
    <dl className="grid gap-x-8 gap-y-3 border-t border-app-rule px-3.5 py-3.5 md:grid-cols-[minmax(10rem,0.4fr)_1fr]">
      {entries.map((e) => (
        <React.Fragment key={e.key}>
          <dt className="text-[13px] text-app-muted">{e.label}</dt>
          <dd className="text-sm break-words text-ink">
            {Array.isArray(e.value)
              ? <ul className="list-disc pl-5">{e.value.map((v, i) => <li key={i}>{v}</li>)}</ul>
              : e.value}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

// ---------- Members ----------

const cell = "py-3.5 pr-4 first:pl-5.5 last:pr-5.5";

export function MembersPanel() {
  const members = useQuery(adminMembersQuery);
  const list = members.data ?? [];
  return (
    <Card id="members" title="All members" subtitle={members.data ? `${list.length} profiles · approve or decline directly` : "Every member profile"}>
      <QueryGate query={members} what="members">
        {list.length === 0 ? <Empty>No member profiles yet.</Empty> : (
          <div role="region" aria-label="Members" tabIndex={0} className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <caption className="sr-only">Every member profile</caption>
              <thead>
                <tr className="border-b border-app-rule text-[13px] text-app-muted">
                  {["Name", "Status", "Listed", "Public", "Catalogue", "Email"].map((h) => <th key={h} scope="col" className={cn(cell, "py-2.5 font-normal")}>{h}</th>)}
                  <th scope="col" className={cn(cell, "py-2.5 font-normal")}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>{list.map((m) => <MemberRow key={m.id} member={m} />)}</tbody>
            </table>
          </div>
        )}
      </QueryGate>
    </Card>
  );
}

function MemberRow({ member }: { member: AdminMember }) {
  const setStatus = useSetMemberStatus();
  const name = member.full_name || "Unnamed member";
  return (
    <tr className="border-b border-app-rule align-top last:border-0">
      <th scope="row" className={cn(cell, "font-medium text-ink")}>{name}</th>
      <td className={cell}><StatusChip status={member.status} /></td>
      <td className={cell}>{member.directory_visible ? "Yes" : "No"}</td>
      <td className={cell}>{member.public_profile ? "Yes" : "No"}</td>
      <td className={cell}>{member.catalogue_number ?? "—"}</td>
      <td className={cn(cell, "break-all")}>{member.email ?? "—"}</td>
      <td className={cell}>
        <div className="flex flex-col gap-2">
          <Decisions
            current={member.status}
            options={REVIEW_OPTIONS}
            subject={name}
            pending={setStatus.isPending}
            onDecide={(status) => setStatus.mutate({ id: member.id, status })}
          />
          <MutationError mutation={setStatus} />
          <EmailNotice notice={setStatus.data} />
        </div>
      </td>
    </tr>
  );
}

// ---------- Neighborhoods ----------

/** A logo picker that checks type and size on pick, before anything is sent. */
function useLogoPick() {
  const [logo, setLogo] = React.useState<File>();
  const [error, setError] = React.useState<string | null>(null);
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    setLogo(file);
    try {
      checkLogo(file);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return { logo, error, onChange, clearError: () => setError(null), reset: () => (setLogo(undefined), setError(null)) };
}

/** Label above, control, optional hint (the control's `aria-describedby` is `${id}-hint`). */
function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13.5px] text-app-muted">{label}</label>
      {children}
      {hint && <p id={`${id}-hint`} className="text-xs text-app-muted">{hint}</p>}
    </div>
  );
}

/** A file input dressed as a secondary button; the hint names the allowed files. */
function LogoPicker({ id, label, hint, pick }: { id: string; label: string; hint: string; pick: ReturnType<typeof useLogoPick> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <label className={cn(secondaryButton, "cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-app")}>
          <Icon name="image" className="size-3.75 text-ink-muted" />{label}
          <input id={id} type="file" accept="image/png,image/webp" aria-describedby={`${id}-hint`} className="sr-only" onChange={pick.onChange} />
        </label>
        <span id={`${id}-hint`} className="text-[13px] text-app-muted">{hint}</span>
      </div>
      {pick.error
        ? <p role="alert" className="text-sm text-danger">{pick.error}</p>
        : pick.logo && <p className="text-xs text-app-muted">Selected: {pick.logo.name}</p>}
    </div>
  );
}

const colorField = cn(fieldClass, "h-9 cursor-pointer p-1");

export function NeighborhoodsPanel() {
  const hoods = useQuery(adminNeighborhoodsQuery);
  const list = hoods.data ?? [];
  const nextOrder = list.reduce((max, h) => Math.max(max, h.sort_order), 0) + 1;
  return (
    <Card id="neighborhoods" title="Neighborhoods" subtitle="Names, colors and logos across the constellation">
      <QueryGate query={hoods} what="neighborhoods">
        <AddNeighborhood nextOrder={nextOrder} />
        {list.map((h) => <NeighborhoodRow key={h.slug} hood={h} />)}
      </QueryGate>
    </Card>
  );
}

function AddNeighborhood({ nextOrder }: { nextOrder: number }) {
  const create = useCreateNeighborhood();
  const pick = useLogoPick();
  const [formKey, setFormKey] = React.useState(0);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    pick.clearError();
    create.mutate(
      {
        name: String(f.get("name") ?? ""), slug: String(f.get("slug") ?? "").trim(), color: String(f.get("color") ?? ""),
        sort_order: nextOrder, logo: pick.logo,
      },
      {
        onSuccess: () => { pick.reset(); setFormKey((k) => k + 1); },
        // The row exists; only its logo is missing. Clear the form so a resubmit can't hit "duplicate key".
        onError: (error) => { if (error instanceof LogoNotSavedError) { pick.reset(); setFormKey((k) => k + 1); } },
      },
    );
  }

  return (
    <form key={formKey} onSubmit={submit} aria-label="Add a neighborhood" className="flex flex-col gap-4 bg-app-sunken/60 px-5.5 py-5">
      <h3 className="text-[15px] font-medium text-ink">Add a neighborhood</h3>
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="hood-new-name" label="Name"><input id="hood-new-name" name="name" required maxLength={60} className={fieldClass} /></Field>
        <Field id="hood-new-slug" label="Slug" hint="Lowercase words joined by hyphens. Can’t be changed later.">
          <input id="hood-new-slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="woodside" aria-describedby="hood-new-slug-hint" className={fieldClass} />
        </Field>
        <Field id="hood-new-color" label="Color"><input id="hood-new-color" type="color" name="color" defaultValue="#2f9dff" className={colorField} /></Field>
      </div>
      <LogoPicker id="hood-new-logo" label="Upload a logo" hint="Optional · PNG or WebP, up to 2 MB" pick={pick} />
      <MutationError mutation={create} />
      <div className="flex justify-end"><button type="submit" className={primaryButton} disabled={create.isPending}>Add neighborhood</button></div>
    </form>
  );
}

function NeighborhoodRow({ hood }: { hood: AdminNeighborhood }) {
  const update = useUpdateNeighborhood();
  const pick = useLogoPick();
  const id = (field: string) => `hood-${hood.slug}-${field}`;
  const logoSrc = toneFor(hood.name, [hood])?.logoSrc;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    pick.clearError();
    update.mutate(
      {
        slug: hood.slug, name: String(f.get("name") ?? ""), color: String(f.get("color") ?? ""),
        active: f.get("active") === "on", sort_order: Number(f.get("sort_order") ?? hood.sort_order),
        previousLogoPath: hood.logo_path, logo: pick.logo,
      },
      { onSuccess: pick.reset },
    );
  }

  return (
    // Keyed by the saved values so the uncontrolled defaults follow the refetched row; the mutation (and any
    // warning it returned) lives outside the key and survives.
    <form
      key={[hood.name, hood.color, hood.active, hood.sort_order, hood.logo_path].join("|")}
      onSubmit={submit}
      aria-label={`Edit ${hood.name}`} className="flex flex-col gap-4 px-5.5 py-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-(--hood)" style={hoodStyle(hood.color)}>
          {logoSrc && <img src={logoSrc} alt="" className="size-7 object-contain" />}
        </span>
        <h3 className="min-w-0 flex-1 text-[15px] font-medium break-words text-ink">{hood.name}</h3>
        <Chip tone={hood.active ? "accent" : "muted"}>{hood.active ? "Active" : "Inactive"}</Chip>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field id={id("name")} label="Name"><input id={id("name")} name="name" defaultValue={hood.name} required maxLength={60} className={fieldClass} /></Field>
        <Field id={id("slug")} label="Slug" hint="Fixed after creation.">
          <input id={id("slug")} value={hood.slug} readOnly aria-describedby={`${id("slug")}-hint`} className={cn(fieldClass, "bg-app-sunken text-app-muted")} />
        </Field>
        <Field id={id("color")} label="Color"><input id={id("color")} type="color" name="color" defaultValue={hood.color} className={colorField} /></Field>
        <Field id={id("sort")} label="Sort order"><input id={id("sort")} type="number" name="sort_order" step={1} defaultValue={hood.sort_order} required className={fieldClass} /></Field>
      </div>
      <div className="rounded-lg border border-app-line">
        <Toggle
          id={id("active")}
          name="active"
          defaultChecked={hood.active}
          label="Active"
          description="Inactive neighborhoods leave the pickers and filters; members who chose one keep it."
        />
      </div>
      <LogoPicker id={id("logo")} label="Upload a new logo" hint="PNG or WebP, up to 2 MB" pick={pick} />
      <MutationError mutation={update} />
      {update.data?.warning && <p role="alert" className="text-sm text-app-muted">{update.data.warning}</p>}
      <div className="flex justify-end">
        <button type="submit" className={primaryButton} aria-label={`Save ${hood.name}`} disabled={update.isPending}>Save changes</button>
      </div>
    </form>
  );
}

// ---------- Bookings ----------

const BOOKING_OPTIONS = [{ status: "confirmed" as const, label: "Confirm" }, { status: "declined" as const, label: "Decline" }];

export function BookingsPanel() {
  const bookings = useQuery(adminBookingsQuery);
  const members = useQuery(adminMembersQuery);
  const names = new Map((members.data ?? []).map((m) => [m.id, m.full_name]));
  const nameFor = (userId: string) =>
    names.get(userId) || (members.data ? "Unknown member" : members.isError ? "Member name unavailable" : "Loading name…");
  const list = bookings.data ?? [];
  return (
    <Card id="bookings" title="Headshot bookings" subtitle="Confirm or decline requested sessions">
      <QueryGate query={bookings} what="headshot bookings">
        <NamesError members={members} />
        {list.length === 0
          ? <Empty>No headshot sessions requested yet.</Empty>
          : list.map((b) => <BookingRow key={b.id} booking={b} name={nameFor(b.user_id)} />)}
      </QueryGate>
    </Card>
  );
}

function BookingRow({ booking, name }: { booking: AdminBooking; name: string }) {
  const setStatus = useSetBookingStatus();
  return (
    <Item
      headingId={`booking-${booking.id}`} title={name} status={booking.status}
      details={<>
        <p className={meta}>{formatDay(booking.preferred_date)} · {booking.preferred_time}</p>
        {booking.notes && <p className="mt-1 text-sm break-words text-ink">{booking.notes}</p>}
      </>}
    >
      <MutationError mutation={setStatus} />
      <Decisions
        current={booking.status}
        options={BOOKING_OPTIONS}
        subject={`${name}’s session`}
        pending={setStatus.isPending}
        onDecide={(status) => setStatus.mutate({ id: booking.id, status })}
      />
    </Item>
  );
}
