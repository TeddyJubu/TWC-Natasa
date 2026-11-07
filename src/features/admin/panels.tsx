// The four /admin tabs. Data and rules live in ./queries, ./mutations and ./format; these only render.
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, FileUpload, FormActions, FormField, Input, Switch } from "@/index";
import { toneFor } from "@/features/neighborhoods/tone";
import {
  adminApplicationsQuery, adminBookingsQuery, adminMembersQuery, adminNeighborhoodsQuery,
  type AdminApplication, type AdminBooking, type AdminMember, type AdminNeighborhood,
} from "./queries";
import {
  LogoNotSavedError, useCreateNeighborhood, useReviewApplication, useSetBookingStatus, useSetMemberStatus, useUpdateNeighborhood,
} from "./mutations";
import { checkLogo, formatAnswers, formatDate, formatDay, humanizeKey, reviewerName, type AnswerEntry } from "./format";

const errorMessage = (error: unknown) =>
  (error as { message?: string } | null)?.message || "Something went wrong. Please try again.";

/** Inline `--hood` for a neighborhood color, consumed via `bg-(--hood)`. */
const hoodStyle = (color: string) => ({ "--hood": color }) as React.CSSProperties;

// ---------- Shared states ----------

function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-4 text-sm text-ink-muted">
      <p>We couldn’t load {what} right now.</p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>Retry</Button>
    </div>
  );
}

/** Loading or failed-before-any-data state; null once data is in. A failed refresh keeps the data and shows the error above it. */
type Loadable = { data: unknown; isError: boolean; refetch: () => unknown };

function QueryGate({ query, what, children }: { query: Loadable; what: string; children: React.ReactNode }) {
  const retry = () => void query.refetch();
  if (query.data === undefined) {
    return query.isError
      ? <LoadError what={what} onRetry={retry} />
      : <p role="status" className="text-sm text-ink-muted">Loading {what}…</p>;
  }
  return (
    <div className="flex flex-col gap-8">
      {query.isError && <LoadError what={`the latest ${what}`} onRetry={retry} />}
      {children}
    </div>
  );
}

/** Names come from the members list; say so (with Retry) when it fails, rather than guessing. */
function NamesError({ members }: { members: Loadable }) {
  return members.isError ? <LoadError what="member names" onRetry={() => void members.refetch()} /> : null;
}

function MutationError({ mutation }: { mutation: { isError: boolean; error: unknown } }) {
  return mutation.isError ? <p role="alert" className="text-sm text-danger">{errorMessage(mutation.error)}</p> : null;
}

function StatusBadge({ status }: { status: string }) {
  return <Badge icon={false} variant={status === "pending" || status === "requested" ? "solid" : "soft"}>{humanizeKey(status)}</Badge>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border-t border-line pt-6 text-sm text-ink-muted">{children}</p>;
}

/** Buttons for every outcome except the current one; all disabled while a change is in flight. */
function Decisions<S extends string>({ current, options, subject, pending, onDecide }: {
  current: string; options: { status: S; label: string }[]; subject: string; pending: boolean; onDecide: (status: S) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.filter((o) => o.status !== current).map((o, i) => (
        <Button
          key={o.status}
          type="button"
          size="sm"
          variant={i === 0 ? "ink" : "outline"}
          aria-label={`${o.label} ${subject}`}
          disabled={pending}
          onClick={() => onDecide(o.status)}
        >
          {o.label}
        </Button>
      ))}
    </div>
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
    <QueryGate query={apps} what="applications">
      <NamesError members={members} />
      <p className="text-sm text-ink-muted">{pending} pending · {list.length} in total</p>
      {list.length === 0
        ? <Empty>No applications yet.</Empty>
        : list.map((app) => <ApplicationRow key={app.id} app={app} members={members.data ?? []} />)}
    </QueryGate>
  );
}

function ApplicationRow({ app, members }: { app: AdminApplication; members: AdminMember[] }) {
  const review = useReviewApplication();
  const by = reviewerName(app.reviewed_by, members);
  const answers = formatAnswers(app.answers);
  const headingId = `application-${app.id}`;
  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-5 border-t border-line pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 id={headingId} className="font-display text-2xl">{app.full_name}</h3>
          <p className="mt-1 break-words text-sm text-ink-muted">
            {app.email} · {app.neighborhood || "No neighborhood given"} · Submitted {formatDate(app.created_at)}
          </p>
          <p className="mt-1 text-sm text-ink-muted">{app.user_id ? "Linked to an account" : "No account yet"}</p>
        </div>
        <StatusBadge status={app.status} />
      </div>
      {app.status !== "pending" && (
        <p className="text-sm text-ink-muted">{humanizeKey(app.status)} {formatDate(app.reviewed_at)}{by && ` by ${by}`}</p>
      )}
      {answers.length > 0 && (
        <details className="group rounded-card border border-line p-5">
          <summary className="cursor-pointer text-sm">Answers ({answers.length})</summary>
          <AnswerList entries={answers} />
        </details>
      )}
      <MutationError mutation={review} />
      <Decisions
        current={app.status}
        options={REVIEW_OPTIONS}
        subject={app.full_name}
        pending={review.isPending}
        onDecide={(status) => review.mutate({ id: app.id, status })}
      />
    </article>
  );
}

function AnswerList({ entries }: { entries: AnswerEntry[] }) {
  return (
    <dl className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-[minmax(10rem,0.4fr)_1fr]">
      {entries.map((e) => (
        <React.Fragment key={e.key}>
          <dt className="text-xs uppercase text-ink-muted">{e.label}</dt>
          <dd className="break-words text-sm">
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

export function MembersPanel() {
  const members = useQuery(adminMembersQuery);
  const list = members.data ?? [];
  return (
    <QueryGate query={members} what="members">
      {list.length === 0 ? <Empty>No member profiles yet.</Empty> : (
        <div role="region" aria-label="Members" tabIndex={0} className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <caption className="sr-only">Every member profile</caption>
            <thead>
              <tr className="border-b border-line text-xs uppercase text-ink-muted">
                {["Name", "Status", "Listed", "Public", "Catalogue", "Email"].map((h) => <th key={h} scope="col" className="py-3 pr-4 font-medium">{h}</th>)}
                <th scope="col" className="py-3 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>{list.map((m) => <MemberRow key={m.id} member={m} />)}</tbody>
          </table>
        </div>
      )}
    </QueryGate>
  );
}

function MemberRow({ member }: { member: AdminMember }) {
  const setStatus = useSetMemberStatus();
  const name = member.full_name || "Unnamed member";
  return (
    <tr className="border-b border-line align-top">
      <th scope="row" className="py-4 pr-4 font-normal">{name}</th>
      <td className="py-4 pr-4"><StatusBadge status={member.status} /></td>
      <td className="py-4 pr-4">{member.directory_visible ? "Yes" : "No"}</td>
      <td className="py-4 pr-4">{member.public_profile ? "Yes" : "No"}</td>
      <td className="py-4 pr-4">{member.catalogue_number ?? "—"}</td>
      <td className="break-all py-4 pr-4">{member.email ?? "—"}</td>
      <td className="py-4">
        <div className="flex flex-col gap-2">
          <Decisions
            current={member.status}
            options={REVIEW_OPTIONS}
            subject={name}
            pending={setStatus.isPending}
            onDecide={(status) => setStatus.mutate({ id: member.id, status })}
          />
          <MutationError mutation={setStatus} />
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

function LogoNote({ pick }: { pick: ReturnType<typeof useLogoPick> }) {
  if (pick.error) return <p role="alert" className="text-sm text-danger">{pick.error}</p>;
  return pick.logo ? <p className="text-xs text-ink-muted">Selected: {pick.logo.name}</p> : null;
}

export function NeighborhoodsPanel() {
  const hoods = useQuery(adminNeighborhoodsQuery);
  const list = hoods.data ?? [];
  const nextOrder = list.reduce((max, h) => Math.max(max, h.sort_order), 0) + 1;
  return (
    <QueryGate query={hoods} what="neighborhoods">
      <AddNeighborhood nextOrder={nextOrder} />
      <div className="grid gap-6 lg:grid-cols-2">
        {list.map((h) => <NeighborhoodRow key={h.slug} hood={h} />)}
      </div>
    </QueryGate>
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
    <form key={formKey} onSubmit={submit} aria-label="Add a neighborhood" className="flex flex-col gap-6 rounded-panel border border-line p-6">
      <h3 className="font-display text-2xl">Add a Neighborhood</h3>
      <div className="grid gap-6 md:grid-cols-3">
        <FormField label="Name" htmlFor="hood-new-name"><Input variant="boxed" name="name" required maxLength={60} /></FormField>
        <FormField label="Slug" htmlFor="hood-new-slug" hint="Lowercase words joined by hyphens. Can’t be changed later.">
          <Input variant="boxed" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="woodside" />
        </FormField>
        <FormField label="Color" htmlFor="hood-new-color"><Input variant="boxed" type="color" name="color" defaultValue="#2f9dff" /></FormField>
      </div>
      <div className="flex flex-col gap-3">
        <FileUpload id="hood-new-logo" label="Upload a logo" hint="Optional · PNG or WebP, up to 2 MB" accept="image/png,image/webp" onChange={pick.onChange} />
        <LogoNote pick={pick} />
      </div>
      <MutationError mutation={create} />
      <FormActions><Button type="submit" variant="ink" disabled={create.isPending}>Add neighborhood</Button></FormActions>
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
      aria-label={`Edit ${hood.name}`} className="flex flex-col gap-6 rounded-panel border border-line p-6">
      <div className="flex items-center gap-4">
        <span aria-hidden className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-(--hood)" style={hoodStyle(hood.color)}>
          {logoSrc && <img src={logoSrc} alt="" className="size-10 object-contain" />}
        </span>
        <h3 className="min-w-0 flex-1 break-words font-display text-2xl">{hood.name}</h3>
        <Badge icon={false} variant={hood.active ? "solid" : "soft"}>{hood.active ? "Active" : "Inactive"}</Badge>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField label="Name" htmlFor={id("name")}><Input variant="boxed" name="name" defaultValue={hood.name} required maxLength={60} /></FormField>
        <FormField label="Slug" htmlFor={id("slug")} hint="Fixed after creation."><Input variant="boxed" value={hood.slug} readOnly /></FormField>
        <FormField label="Color" htmlFor={id("color")}><Input variant="boxed" type="color" name="color" defaultValue={hood.color} /></FormField>
        <FormField label="Sort order" htmlFor={id("sort")}><Input variant="boxed" type="number" name="sort_order" step={1} defaultValue={hood.sort_order} required /></FormField>
      </div>
      <Switch
        id={id("active")}
        name="active"
        defaultChecked={hood.active}
        label="Active"
        description="Inactive neighborhoods leave the pickers and filters; members who chose one keep it."
      />
      <div className="flex flex-col gap-3">
        <FileUpload id={id("logo")} label="Upload a new logo" hint="PNG or WebP, up to 2 MB" accept="image/png,image/webp" onChange={pick.onChange} />
        <LogoNote pick={pick} />
      </div>
      <MutationError mutation={update} />
      {update.data?.warning && <p role="alert" className="text-sm text-ink-muted">{update.data.warning}</p>}
      <FormActions>
        <Button type="submit" variant="ink" aria-label={`Save ${hood.name}`} disabled={update.isPending}>Save changes</Button>
      </FormActions>
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
    <QueryGate query={bookings} what="headshot bookings">
      <NamesError members={members} />
      {list.length === 0
        ? <Empty>No headshot sessions requested yet.</Empty>
        : list.map((b) => <BookingRow key={b.id} booking={b} name={nameFor(b.user_id)} />)}
    </QueryGate>
  );
}

function BookingRow({ booking, name }: { booking: AdminBooking; name: string }) {
  const setStatus = useSetBookingStatus();
  const headingId = `booking-${booking.id}`;
  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-4 border-t border-line pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 id={headingId} className="font-display text-2xl">{name}</h3>
          <p className="mt-1 text-sm text-ink-muted">{formatDay(booking.preferred_date)} · {booking.preferred_time}</p>
          {booking.notes && <p className="mt-2 break-words text-sm">{booking.notes}</p>}
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <MutationError mutation={setStatus} />
      <Decisions
        current={booking.status}
        options={BOOKING_OPTIONS}
        subject={`${name}’s session`}
        pending={setStatus.isPending}
        onDecide={(status) => setStatus.mutate({ id: booking.id, status })}
      />
    </article>
  );
}
