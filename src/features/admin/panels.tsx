// The /admin cards (sidebar anchors). Data and rules live in ./queries, ./mutations and ./format; these only render.
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/index";
import { fieldClass, primaryButton, ring, secondaryButton } from "@/app/layout/app-classes";
import { Card, Chip, InlineError, Toggle, type ChipTone } from "@/app/layout/app-ui";
import { Icon } from "@/app/layout/icons";
import { toneFor } from "@/features/neighborhoods/tone";
import { useNeighborhoods } from "@/features/neighborhoods/queries";
import { pickerNames } from "@/features/neighborhoods/options";
import { EVENT_KINDS, eventWhen, isoToNyLocal, kindLabel, nyLocalToISO } from "@/features/events/format";
import {
  adminApplicationsQuery, adminBookingsQuery, adminEventsQuery, adminInboxQuery, adminMembersQuery, adminNeighborhoodsQuery,
  type AdminApplication, type AdminBooking, type AdminEvent, type AdminMember, type AdminNeighborhood, type InboxMessage,
} from "./queries";
import {
  LogoNotSavedError, useArchiveMessage, useCreateNeighborhood, useDeleteEvent, useReviewApplication, useSaveEvent, useSetBookingStatus, useSetMemberStatus,
  useUpdateNeighborhood,
} from "./mutations";
import type { ApprovalNotice } from "./approval-email";
import { checkLogo, formatAnswers, formatDate, formatDay, humanizeKey, reviewerName, type AnswerEntry } from "./format";
import {
  adminReviewsQuery, reviewLinkStatesQuery, useMarkReviewDone, useMintReviewLink, useRevokeReviewLink, type AdminReview, type LinkState,
} from "@/features/member-links/queries";
import { reviewEntries } from "@/features/member-links/schema";

const errorMessage = (error: unknown) =>
  (error as { message?: string } | null)?.message || "Something went wrong. Please try again.";

/** Inline `--hood` for a neighborhood color, consumed via `bg-(--hood)`. */
const hoodStyle = (color: string) => ({ "--hood": color }) as React.CSSProperties;

const meta = "text-[13px]/[1.5] text-app-muted";
const pad = "px-5 sm:px-7";

// ---------- Shared states ----------

/** Loading or failed-before-any-data state; the rows once data is in. A failed refresh keeps the data and shows the error above it. */
type Loadable = { data: unknown; isError: boolean; refetch: () => unknown };

function QueryGate({ query, what, children }: { query: Loadable; what: string; children: React.ReactNode }) {
  const retry = () => void query.refetch();
  if (query.data === undefined) {
    return query.isError
      ? <InlineError message={`We couldn’t load ${what} right now.`} onRetry={retry} />
      : <p role="status" className={cn(pad, "py-4 text-sm text-app-muted")}>Loading {what}…</p>;
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

/** Waiting on an admin (pending, requested) in sun; approved/confirmed in mint; declined in danger. */
const STATUS_TONE: Record<string, ChipTone> = { pending: "pending", requested: "pending", approved: "ok", confirmed: "ok", declined: "no" };
function StatusChip({ status }: { status: string }) {
  return <Chip tone={STATUS_TONE[status] ?? "muted"}>{humanizeKey(status)}</Chip>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className={cn(pad, "py-4 text-[15px] text-app-muted")}>{children}</p>;
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
    <article aria-labelledby={headingId} className={cn(pad, "flex flex-col gap-3.5 py-5")}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id={headingId} className="text-base font-medium break-words text-ink">{title}</h3>
          {details}
        </div>
        <StatusChip status={status} />
      </div>
      {children}
    </article>
  );
}

// ---------- Inbox ----------

export function InboxPanel() {
  const inbox = useQuery(adminInboxQuery);
  const list = inbox.data ?? [];
  return (
    <Card id="inbox" title="Inbox" subtitle={inbox.data ? `${list.length} waiting · contact messages and partnership inquiries` : "Contact messages and partnership inquiries"}>
      <QueryGate query={inbox} what="messages">
        {list.length === 0 ? <Empty>Nothing waiting.</Empty> : list.map((m) => <InboxRow key={m.id} message={m} />)}
      </QueryGate>
    </Card>
  );
}

function InboxRow({ message: m }: { message: InboxMessage }) {
  const archive = useArchiveMessage();
  const about = m.kind === "contact"
    ? m.topic
    : [`Partnership: ${humanizeKey(m.collaboration_type ?? "other")}`, m.business].filter(Boolean).join(" · ");
  return (
    <Item
      headingId={`message-${m.id}`} title={m.name} status={m.kind === "contact" ? "contact" : "partnership"}
      details={<p className={cn(meta, "break-words")}>
        <a className={cn("underline", ring)} href={`mailto:${m.email}`}>{m.email}</a> · {about} · Received {formatDate(m.created_at)}
      </p>}
    >
      <details className="group rounded-md bg-app-sunken">
        <summary className={cn("flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md px-3.5 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden", ring)}>
          <Icon name="chevron-down" className="size-3.25 -rotate-90 text-app-muted transition-transform group-open:rotate-0 motion-reduce:transition-none" />
          Message
        </summary>
        <p className="border-t border-app-rule px-3.5 py-3.5 text-sm break-words whitespace-pre-line text-ink">{m.message}</p>
      </details>
      <MutationError mutation={archive} />
      <div>
        <button type="button" className={secondaryButton} aria-label={`Archive the message from ${m.name}`} disabled={archive.isPending}
          onClick={() => archive.mutate(m.id)}>
          Archive
        </button>
      </div>
    </Item>
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
        <details className="group rounded-md bg-app-sunken">
          <summary className={cn("flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md px-3.5 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden", ring)}>
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

const cell = "py-4 pr-5 first:pl-5 last:pr-5 sm:first:pl-7 sm:last:pr-7";
/** Table header cells: the kit's eyebrow. */
const headCell = cn(cell, "twc-eyebrow py-3.5 whitespace-nowrap");

export function MembersPanel() {
  const members = useQuery(adminMembersQuery);
  const links = useQuery(reviewLinkStatesQuery);
  const list = members.data ?? [];
  return (
    <Card id="members" title="All members" subtitle={members.data ? `${list.length} profiles · approve or decline directly` : "Every member profile"}>
      <QueryGate query={members} what="members">
        {links.isError && <InlineError message="We couldn’t load review links right now." onRetry={() => void links.refetch()} />}
        {list.length === 0 ? <Empty>No member profiles yet.</Empty> : (
          // `relative` contains the sr-only (absolute) caption and header, or they escape the scroll clip and widen the page.
          <div role="region" aria-label="Members" tabIndex={0} className="relative overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-app-accent">
            <table className="w-full min-w-[52rem] text-left text-[15px]">
              <caption className="sr-only">Every member profile</caption>
              <thead>
                <tr className="border-b border-app-rule">
                  {["Name", "Status", "Listed", "Public", "Catalogue", "Email"].map((h) => <th key={h} scope="col" className={headCell}>{h}</th>)}
                  <th scope="col" className={headCell}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>{list.map((m) => <MemberRow key={m.id} member={m} link={links.data?.[m.id] ?? null} />)}</tbody>
            </table>
          </div>
        )}
      </QueryGate>
    </Card>
  );
}

function MemberRow({ member, link }: { member: AdminMember; link: LinkState | null }) {
  const setStatus = useSetMemberStatus();
  const name = member.full_name || "Unnamed member";
  return (
    <tr className="border-b border-app-rule align-top last:border-0">
      <th scope="row" className={cn(cell, "font-medium text-ink")}>{name}</th>
      <td className={cell}><StatusChip status={member.status} /></td>
      <td className={cell}>{member.directory_visible ? "Yes" : "No"}</td>
      <td className={cell}>{member.public_profile ? "Yes" : "No"}</td>
      <td className={cn(cell, "twc-index whitespace-nowrap")}>{member.catalogue_number === null ? "—" : `Nº ${String(member.catalogue_number).padStart(3, "0")}`}</td>
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
          {member.status === "approved" && <ReviewLink memberId={member.id} name={name} link={link} />}
        </div>
      </td>
    </tr>
  );
}

const LINK_STATE: Record<LinkState["state"], (l: LinkState) => string> = {
  active: (l) => `Review link open until ${formatDate(l.expires_at)}`,
  used: (l) => `Review link used ${formatDate(l.used_at)}`,
  expired: (l) => `Review link closed ${formatDate(l.expires_at)}`,
};

/**
 * A personal review link (CRM-082–089): its state, Make / Revoke, and the new URL shown once to copy into the
 * admin's own message. Only its hash is stored, so a lost URL means making a new one (which closes the old).
 */
function ReviewLink({ memberId, name, link }: { memberId: string; name: string; link: LinkState | null }) {
  const mint = useMintReviewLink();
  const revoke = useRevokeReviewLink();
  const [copied, setCopied] = React.useState(false);
  const busy = mint.isPending || revoke.isPending;
  const copy = (url: string) => navigator.clipboard?.writeText(url).then(() => setCopied(true), () => setCopied(false));
  return (
    <div className="flex flex-col gap-2 border-t border-app-rule pt-2">
      {link && <p className={meta}>{LINK_STATE[link.state](link)}</p>}
      <div className="flex flex-wrap gap-2.5">
        <button type="button" className={secondaryButton} aria-label={`Make a review link for ${name}`} disabled={busy}
          onClick={() => { setCopied(false); revoke.reset(); mint.mutate(memberId); }}>
          {link?.state === "active" ? "New review link" : "Make review link"}
        </button>
        {link?.state === "active" && (
          <button type="button" className={secondaryButton} aria-label={`Revoke the review link for ${name}`} disabled={busy}
            onClick={() => { mint.reset(); revoke.mutate(memberId); }}>
            Revoke
          </button>
        )}
      </div>
      <MutationError mutation={mint} />
      <MutationError mutation={revoke} />
      {mint.data && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`link-${memberId}`} className={meta}>Shown once — copy it into your own message to {name}. Opens one time, until {formatDate(mint.data.expires_at)}.</label>
          <div className="flex gap-2">
            <input id={`link-${memberId}`} readOnly value={mint.data.url} className={cn(fieldClass, "min-w-0 flex-1")} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className={secondaryButton} onClick={() => copy(mint.data.url)}>Copy</button>
          </div>
          {copied && <p role="status" className={meta}>Copied</p>}
        </div>
      )}
    </div>
  );
}

// ---------- Member reviews ----------

export function MemberReviewsPanel() {
  const reviews = useQuery(adminReviewsQuery);
  const list = reviews.data ?? [];
  return (
    <Card id="reviews" title="Member reviews" subtitle={reviews.data ? `${list.length} waiting · answers from personal review links` : "Answers from personal review links"}>
      <QueryGate query={reviews} what="member reviews">
        {list.length === 0 ? <Empty>Nothing waiting.</Empty> : list.map((r) => <ReviewRow key={r.id} review={r} />)}
      </QueryGate>
    </Card>
  );
}

/** Nothing here changes her profile: a person applies corrections and removals by hand (OPS-020, OPS-089). */
function ReviewRow({ review: r }: { review: AdminReview }) {
  const done = useMarkReviewDone();
  const name = r.full_name || "Unnamed member";
  const entries = reviewEntries(r.answers);
  return (
    <Item
      headingId={`review-${r.id}`} title={name} status={String(r.answers.membership ?? "review")}
      details={<p className={meta}>Sent {formatDate(r.created_at)}</p>}
    >
      <details className="group rounded-md bg-app-sunken">
        <summary className={cn("flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md px-3.5 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden", ring)}>
          <Icon name="chevron-down" className="size-3.25 -rotate-90 text-app-muted transition-transform group-open:rotate-0 motion-reduce:transition-none" />
          Answers ({entries.length})
        </summary>
        <AnswerList entries={entries} />
      </details>
      <MutationError mutation={done} />
      <div>
        <button type="button" className={secondaryButton} aria-label={`Mark the review from ${name} as handled`} disabled={done.isPending}
          onClick={() => done.mutate(r.id)}>
          Mark handled
        </button>
      </div>
    </Item>
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
    <div className="twc-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p id={`${id}-hint`} className="twc-hint">{hint}</p>}
    </div>
  );
}

/** A file input dressed as a secondary button; the hint names the allowed files. */
function LogoPicker({ id, label, hint, pick }: { id: string; label: string; hint: string; pick: ReturnType<typeof useLogoPick> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <label className={cn(secondaryButton, "cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-app-accent")}>
          <Icon name="image" className="size-3.75" />{label}
          <input id={id} type="file" accept="image/png,image/webp" aria-describedby={`${id}-hint`} className="sr-only" onChange={pick.onChange} />
        </label>
        <span id={`${id}-hint`} className="twc-hint">{hint}</span>
      </div>
      {pick.error
        ? <p role="alert" className="text-sm text-danger">{pick.error}</p>
        : pick.logo && <p className="text-xs text-app-muted">Selected: {pick.logo.name}</p>}
    </div>
  );
}

const colorField = cn(fieldClass, "h-13 cursor-pointer p-1.5");
/** A cream sub-panel inside a card: the add/edit forms. */
const subpanel = "m-3 flex flex-col gap-5 rounded-md bg-app-sunken p-5 sm:m-5";

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
    <form key={formKey} onSubmit={submit} aria-label="Add a neighborhood" className={subpanel}>
      <h3 className="font-display text-xl/[1.3] text-ink">Add a neighborhood</h3>
      <div className="grid gap-5 md:grid-cols-3">
        <Field id="hood-new-name" label="Name"><input id="hood-new-name" name="name" required maxLength={60} className={fieldClass} /></Field>
        <Field id="hood-new-slug" label="Slug" hint="Lowercase words joined by hyphens. Can’t be changed later.">
          <input id="hood-new-slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="woodside" aria-describedby="hood-new-slug-hint" className={fieldClass} />
        </Field>
        <Field id="hood-new-color" label="Color"><input id="hood-new-color" type="color" name="color" defaultValue="#2f9dff" className={colorField} /></Field>
      </div>
      <LogoPicker id="hood-new-logo" label="Upload a logo" hint="Optional · PNG or WebP, up to 2 MB" pick={pick} />
      <MutationError mutation={create} />
      <div className="flex justify-end"><button type="submit" className={primaryButton} disabled={create.isPending}>Add neighborhood <span aria-hidden className="twc-arrow">→</span></button></div>
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
      aria-label={`Edit ${hood.name}`} className={cn(pad, "flex flex-col gap-5 py-5")}>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
        <span aria-hidden className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-(--hood)" style={hoodStyle(hood.color)}>
          {logoSrc && <img src={logoSrc} alt="" className="size-5.5 object-contain" />}
        </span>
        <h3 className="min-w-0 font-display text-xl/[1.3] break-words text-ink">{hood.name}</h3>
        <span className="twc-index mr-auto">{hood.slug} · order {hood.sort_order}</span>
        <Chip tone={hood.active ? "ok" : "muted"}>{hood.active ? "Active" : "Inactive"}</Chip>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field id={id("name")} label="Name"><input id={id("name")} name="name" defaultValue={hood.name} required maxLength={60} className={fieldClass} /></Field>
        <Field id={id("slug")} label="Slug" hint="Fixed after creation.">
          <input id={id("slug")} value={hood.slug} readOnly aria-describedby={`${id("slug")}-hint`} className={cn(fieldClass, "bg-app-sunken text-app-muted")} />
        </Field>
        <Field id={id("color")} label="Color"><input id={id("color")} type="color" name="color" defaultValue={hood.color} className={colorField} /></Field>
        <Field id={id("sort")} label="Sort order"><input id={id("sort")} type="number" name="sort_order" step={1} defaultValue={hood.sort_order} required className={fieldClass} /></Field>
      </div>
      <div className="rounded-md shadow-[inset_0_0_0_1px_var(--color-app-line)]">
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

// ---------- Gatherings ----------

/** Upcoming gatherings in a table, past ones folded below; Add/Edit open the form and Guest list the RSVPs, in this card. */
export function GatheringsPanel() {
  const events = useQuery(adminEventsQuery);
  const [editing, setEditing] = React.useState<AdminEvent | "new" | null>(null);
  const [guestsOf, setGuestsOf] = React.useState<string | null>(null);
  const list = events.data ?? [];
  const now = new Date().toISOString();
  const upcoming = list.filter((e) => e.starts_at >= now);
  const past = list.filter((e) => e.starts_at < now).reverse();
  const guestEvent = list.find((e) => e.id === guestsOf);
  const actions = { onEdit: (e: AdminEvent) => setEditing(e), onGuests: (e: AdminEvent) => setGuestsOf(e.id) };
  return (
    <Card
      id="gatherings" title="Gatherings" subtitle="Put the next one on the calendar"
      action={<button type="button" className={cn(primaryButton, "shrink-0")} onClick={() => setEditing("new")}>Add a gathering</button>}
    >
      <QueryGate query={events} what="gatherings">
        {upcoming.length === 0
          ? <Empty>Nothing on the calendar yet. Add the first gathering and members will see it on their account.</Empty>
          : <GatheringsTable rows={upcoming} caption="Upcoming gatherings" {...actions} />}
        {past.length > 0 && (
          <details className="group">
            <summary className={cn(pad, "flex min-h-12 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden", ring)}>
              <Icon name="chevron-down" className="size-3.25 -rotate-90 text-app-muted transition-transform group-open:rotate-0 motion-reduce:transition-none" />
              Past gatherings ({past.length})
            </summary>
            <GatheringsTable rows={past} caption="Past gatherings" {...actions} />
          </details>
        )}
      </QueryGate>
      {editing && (
        <GatheringForm key={editing === "new" ? "new" : editing.id} event={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      )}
      {guestEvent && <GuestList event={guestEvent} onClose={() => setGuestsOf(null)} />}
    </Card>
  );
}

function GatheringsTable({ rows, caption, onEdit, onGuests }: {
  rows: AdminEvent[]; caption: string; onEdit: (e: AdminEvent) => void; onGuests: (e: AdminEvent) => void;
}) {
  const { data: hoodList = [] } = useNeighborhoods();
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="relative overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-app-accent">
      <table className="w-full min-w-[48rem] text-left text-[15px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-app-rule">
            {["When", "Gathering", "Neighborhood", "Seats saved"].map((h) => <th key={h} scope="col" className={headCell}>{h}</th>)}
            <th scope="col" className={headCell}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const when = eventWhen(e.starts_at);
            const color = toneFor(e.neighborhood, hoodList)?.color;
            return (
              <tr key={e.id} className="border-b border-app-rule align-middle last:border-0">
                <td className={cell}>
                  <div className="flex items-center gap-3.5 whitespace-nowrap">
                    <span className="flex w-14 shrink-0 flex-col gap-0.5 rounded-md bg-app-sunken pt-1.5 pb-2 text-center">
                      <span className="font-fragment text-[11px]/[14px] tracking-[1px] uppercase text-app-muted">{when.month}</span>
                      <span className="font-display text-[26px]/none text-ink">{when.day}</span>
                    </span>
                    <span>{when.weekday} · {when.time}</span>
                  </div>
                </td>
                <th scope="row" className={cn(cell, "min-w-52 font-normal")}>
                  <span className="block font-display text-xl/[1.3] text-ink">{e.title}</span>
                  <span className={meta}>{kindLabel(e.kind)} · {e.location}</span>
                </th>
                <td className={cell}>
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span aria-hidden className={cn("size-2 rounded-full", color ? "bg-(--hood)" : "bg-app-line")} style={color ? hoodStyle(color) : undefined} />
                    {e.neighborhood}
                  </span>
                </td>
                <td className={cn(cell, "font-fragment tabular-nums")}>{e.guests.length}</td>
                <td className={cell}>
                  <div className="flex gap-2">
                    <button type="button" className={cn(secondaryButton, "whitespace-nowrap")} aria-label={`Edit ${e.title}`} onClick={() => onEdit(e)}>Edit</button>
                    <button type="button" className={cn(secondaryButton, "whitespace-nowrap")} aria-label={`Guest list for ${e.title}`} onClick={() => onGuests(e)}>Guest list</button>
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

/** Add or edit one gathering (today's columns only). The time is typed as New York wall-clock time. */
function GatheringForm({ event, onDone }: { event: AdminEvent | null; onDone: () => void }) {
  const save = useSaveEvent();
  const remove = useDeleteEvent();
  const { data: hoodList = [] } = useNeighborhoods();
  const [timeError, setTimeError] = React.useState(false);
  const titleRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => titleRef.current?.focus(), []);
  const id = (field: string) => `gathering-${event?.id ?? "new"}-${field}`;
  const busy = save.isPending || remove.isPending;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const startsAt = nyLocalToISO(String(f.get("starts_at") ?? ""));
    setTimeError(!startsAt);
    if (!startsAt) return;
    save.mutate(
      {
        id: event?.id, title: String(f.get("title") ?? "").trim(), kind: String(f.get("kind") ?? ""), starts_at: startsAt,
        neighborhood: String(f.get("neighborhood") ?? ""), location: String(f.get("location") ?? "").trim(),
        description: String(f.get("description") ?? "").trim(),
      },
      { onSuccess: onDone },
    );
  }

  function confirmDelete() {
    if (!event) return;
    const n = event.guests.length;
    if (window.confirm(`Delete ${event.title}? ${n} saved seat${n === 1 ? " goes" : "s go"} with it.`)) remove.mutate(event.id, { onSuccess: onDone });
  }

  return (
    <form onSubmit={submit} aria-labelledby={id("heading")} className={subpanel}>
      <div className="flex flex-col gap-0.5">
        <h3 id={id("heading")} className="font-display text-xl/[1.3] text-ink">{event ? `Edit ${event.title}` : "Add a gathering"}</h3>
        <p className={meta}>Members see it in Gatherings as soon as you save.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field id={id("title")} label="Title">
            <input ref={titleRef} id={id("title")} name="title" required maxLength={200} defaultValue={event?.title} placeholder="Founders Supper Club" className={fieldClass} />
          </Field>
        </div>
        <Field id={id("kind")} label="Kind">
          <select id={id("kind")} name="kind" defaultValue={event?.kind ?? "gathering"} className={fieldClass}>
            {pickerKinds(event?.kind).map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
          </select>
        </Field>
        <Field id={id("when")} label="Date and start time" hint="New York time.">
          <input
            id={id("when")} name="starts_at" type="datetime-local" required defaultValue={event ? isoToNyLocal(event.starts_at) : undefined}
            aria-describedby={`${id("when")}-hint`} aria-invalid={timeError || undefined} className={fieldClass}
          />
        </Field>
        <Field id={id("hood")} label="Neighborhood">
          <select id={id("hood")} name="neighborhood" required defaultValue={event?.neighborhood ?? ""} className={fieldClass}>
            <option value="" disabled>Choose a neighborhood</option>
            {pickerNames(hoodList, event?.neighborhood).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field id={id("location")} label="Location">
          <input id={id("location")} name="location" required maxLength={200} defaultValue={event?.location} placeholder="Bistro on 37th Avenue" className={fieldClass} />
        </Field>
        <div className="md:col-span-2">
          <Field id={id("description")} label="Description" hint="One or two sentences. Shown under the title.">
            <textarea
              id={id("description")} name="description" rows={3} maxLength={600} defaultValue={event?.description}
              placeholder="A long-table dinner and honest conversation about growing a business." aria-describedby={`${id("description")}-hint`} className={fieldClass}
            />
          </Field>
        </div>
      </div>
      {timeError && <p role="alert" className="text-sm text-danger">Choose a date and start time.</p>}
      <MutationError mutation={save} />
      <MutationError mutation={remove} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {event ? <button type="button" className={secondaryButton} disabled={busy} onClick={confirmDelete}>Delete gathering</button> : <span />}
        <div className="flex gap-2.5">
          <button type="button" className={secondaryButton} onClick={onDone}>Cancel</button>
          <button type="submit" className={primaryButton} disabled={busy}>Save gathering <span aria-hidden className="twc-arrow">→</span></button>
        </div>
      </div>
    </form>
  );
}

/** The kinds on offer, plus a stored one the list no longer has, so editing never silently changes it. */
const pickerKinds = (current?: string): string[] =>
  current && !(EVENT_KINDS as readonly string[]).includes(current) ? [...EVENT_KINDS, current] : [...EVENT_KINDS];

function GuestList({ event, onClose }: { event: AdminEvent; onClose: () => void }) {
  const [copied, setCopied] = React.useState<"yes" | "no" | null>(null);
  const { data: hoodList = [] } = useNeighborhoods();
  const headingId = `guests-${event.id}`;
  const n = event.guests.length;
  const copy = () => navigator.clipboard.writeText(event.guests.map((g) => g.email).join(", ")).then(() => setCopied("yes"), () => setCopied("no"));
  return (
    <section aria-labelledby={headingId} className="flex flex-col">
      <div className={cn(pad, "flex flex-wrap items-start justify-between gap-3 border-t border-app-line py-5")}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id={headingId} className="font-display text-xl/[1.3] break-words text-ink">Guest list · {event.title}</h3>
          <p className={meta}>{n} member{n === 1 ? "" : "s"} saved a seat</p>
        </div>
        <div className="flex gap-2">
          {n > 0 && <button type="button" className={secondaryButton} onClick={() => void copy()}>Copy emails</button>}
          <button type="button" className={secondaryButton} aria-label={`Close the guest list for ${event.title}`} onClick={onClose}>Close</button>
        </div>
      </div>
      {copied && <p role="status" className={cn(pad, "pb-3 text-sm text-app-muted")}>{copied === "yes" ? "Emails copied" : "Couldn’t copy. Select the emails below instead."}</p>}
      {n === 0 ? <Empty>No seats saved yet.</Empty> : (
        <ul className="divide-y divide-app-rule border-t border-app-rule">
          {event.guests.map((g) => {
            const color = toneFor(g.neighborhood, hoodList)?.color;
            return (
              <li key={g.user_id} className={cn(pad, "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-4")}>
                <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[15px] font-medium text-ink">{g.full_name || "Unnamed member"}</span>
                  {g.catalogue_number !== null && <span className="twc-index">Nº {String(g.catalogue_number).padStart(3, "0")}</span>}
                  {g.neighborhood && (
                    <span className={cn(meta, "inline-flex items-center gap-1.5")}>
                      <span aria-hidden className={cn("size-2 rounded-full", color ? "bg-(--hood)" : "bg-app-line")} style={color ? hoodStyle(color) : undefined} />
                      {g.neighborhood}
                    </span>
                  )}
                  <span className={cn(meta, "break-all")}>{g.email}</span>
                </span>
                <span className={meta}>Saved {formatDate(g.saved_at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
