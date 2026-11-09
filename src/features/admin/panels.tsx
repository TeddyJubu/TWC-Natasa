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
  adminActionsQuery, adminApplicationsQuery, adminBookingsQuery, adminEventsQuery, adminInboxQuery, adminLoggedActionsQuery,
  adminMembersQuery, adminNeighborhoodsQuery, adminNewsletterQuery, adminNotesQuery,
  type AdminApplication, type AdminBooking, type AdminEvent, type AdminMember, type AdminNeighborhood, type AdminNote,
  type InboxMessage, type LoggedAction,
} from "./queries";
import {
  LogoNotSavedError, useAddLoggedAction, useAddNote, useArchiveMessage, useCreateNeighborhood, useDeleteEvent, useDeleteNote,
  useDownloadCsv, useEditLoggedAction, useRemoveLoggedAction, useRestoreLoggedAction, useReviewApplication, useSaveEvent,
  useSetBookingStatus, useSetMemberNeighborhood, useSetMemberStatus, useUpdateNeighborhood, type LoggedActionInput, type NoteInput,
} from "./mutations";
import type { ApprovalNotice } from "./approval-email";
import {
  applicationOrigin, checkLogo, describeAction, DUPLICATE_TEXT, formatAnswers, formatDate, formatDay, humanizeKey,
  LOGGED_ACTION_KINDS, LOGGED_ACTION_LABELS, matchesSearch, newestByUser, newsletterLabel, subscriberConsentLabel,
  reviewerName, type AnswerEntry, type LoggedActionKind,
} from "./format";
import {
  adminReviewsQuery, adminSpotlightsQuery, reviewLinkStatesQuery, spotlightLinkStatesQuery, useMarkReviewDone, useMintReviewLink, useRevokeReviewLink,
  type AdminReview, type AdminSpotlight, type LinkState, type Purpose,
} from "@/features/member-links/queries";
import { reviewEntries } from "@/features/member-links/schema";
import { spotlightEntries } from "@/features/member-links/spotlight";
import { adminFormResponsesQuery, useDownloadFormCsv, useSetFormOpen, type AdminForm } from "@/features/forms/queries";

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
const STATUS_TONE: Record<string, ChipTone> = { pending: "pending", requested: "pending", approved: "ok", confirmed: "ok", open: "ok", declined: "no" };
function StatusChip({ status }: { status: string }) {
  return <Chip tone={STATUS_TONE[status] ?? "muted"}>{humanizeKey(status)}</Chip>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className={cn(pad, "py-4 text-[15px] text-app-muted")}>{children}</p>;
}

/** Confirm copy for a decision (CRM-071). Undo-decline names the restore; everything else is "Label name?". */
function decisionConfirm(label: string, status: string, subject: string): string {
  if (status === "pending") return `Undo decline for ${subject}? She’ll go back to pending.`;
  return `${label} ${subject}?`;
}

/** Buttons for every outcome except the current one; confirm first (CRM-071); disabled while a change is in flight. */
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
          onClick={() => { if (window.confirm(decisionConfirm(o.label, o.status, subject))) onDecide(o.status); }}
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

/** A sunken show/hide panel (native <details>): Message, Answers, Notes, Details. */
function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-md bg-app-sunken">
      <summary className={cn("flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md px-3.5 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden", ring)}>
        <Icon name="chevron-down" className="size-3.25 -rotate-90 text-app-muted transition-transform group-open:rotate-0 motion-reduce:transition-none" />
        {label}
      </summary>
      {children}
    </details>
  );
}

type Option = { value: string; label: string };
const STATUS_FILTER: Option[] = [
  { value: "", label: "Any status" }, { value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "declined", label: "Declined" },
];
const DUPLICATES = "duplicate";
const APPLICATION_FILTER: Option[] = [...STATUS_FILTER, { value: DUPLICATES, label: "Possible duplicates" }];

/** A card's filter (CRM-062): narrows its rows together with the page's search box. */
function FilterSelect({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: Option[]; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={meta}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.currentTarget.value)} className={fieldClass}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/** The page's search box (CRM-041): filters Inbox, Applications, Members and Newsletter as she types. */
export function AdminSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div role="search" className="flex flex-col gap-1.5">
      <label htmlFor="admin-search" className="text-sm font-medium text-ink">Search messages, applications, members and newsletter</label>
      <input id="admin-search" type="search" value={value} onChange={(e) => onChange(e.currentTarget.value)} autoComplete="off"
        aria-describedby="admin-search-hint" className={cn(fieldClass, "max-w-120")} />
      <p id="admin-search-hint" className="twc-hint">Name, email or business</p>
    </div>
  );
}

/** "3 of 12 shown" while a search or filter hides some rows. */
const shownOf = (shown: number, total: number) => (shown < total ? `${shown} of ${total} shown · ` : "");

/** Downloads the card's rows as CSV (admins only, checked on the server). */
function CsvButton({ kind }: { kind: "applications" | "members" }) {
  const csv = useDownloadCsv();
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" className={cn(secondaryButton, "shrink-0")} disabled={csv.isPending} onClick={() => csv.mutate(kind)}>
        Download CSV<span className="sr-only"> of {kind}</span>
      </button>
      <MutationError mutation={csv} />
    </div>
  );
}

/** Private admin notes (0006) on one application or member: oldest first, add one, delete one. No editing. */
function Notes({ subject, name, notes }: { subject: { applicationId: string } | { memberId: string }; name: string; notes: AdminNote[] }) {
  const add = useAddNote();
  const remove = useDeleteNote();
  const [body, setBody] = React.useState("");
  const id = `note-${"applicationId" in subject ? subject.applicationId : subject.memberId}`;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    add.mutate({ ...subject, body } as NoteInput, { onSuccess: () => setBody("") });
  };
  return (
    <Disclosure label={`Notes (${notes.length})`}>
      <div className="flex flex-col gap-3 border-t border-app-rule px-3.5 py-3.5">
        {notes.map((n) => (
          <div key={n.id} className="flex flex-col gap-1">
            <p className="text-sm break-words whitespace-pre-line text-ink">{n.body}</p>
            <div className="flex flex-wrap items-center gap-2.5">
              <p className={meta}>{n.author_name ?? "An admin"} · {formatDate(n.created_at)}</p>
              <button type="button" className={cn("text-[13px] text-app-muted underline", ring)} disabled={remove.isPending}
                aria-label={`Delete this note on ${name}`} onClick={() => { if (window.confirm("Delete this note?")) remove.mutate(n.id); }}>
                Delete
              </button>
            </div>
          </div>
        ))}
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor={id} className={meta}>Add a note about {name} (only admins see it)</label>
          <textarea id={id} rows={2} maxLength={5000} value={body} onChange={(e) => setBody(e.currentTarget.value)} className={fieldClass} />
          <div><button type="submit" className={secondaryButton} disabled={add.isPending || !body.trim()}>Add note</button></div>
        </form>
        <MutationError mutation={add} />
        <MutationError mutation={remove} />
      </div>
    </Disclosure>
  );
}

const notesFor = (notes: AdminNote[] | undefined, key: "application_id" | "member_id", id: string) => (notes ?? []).filter((n) => n[key] === id);
const actionsFor = (actions: LoggedAction[] | undefined, key: "application_id" | "member_id", id: string) => (actions ?? []).filter((a) => a[key] === id);

/** Logged actions (0009 / CRM-057): list, add, edit, soft-remove and restore on one application or member. */
function LoggedActions({ subject, name, actions }: {
  subject: { applicationId: string } | { memberId: string }; name: string; actions: LoggedAction[];
}) {
  const add = useAddLoggedAction();
  const edit = useEditLoggedAction();
  const remove = useRemoveLoggedAction();
  const restore = useRestoreLoggedAction();
  const [kind, setKind] = React.useState<LoggedActionKind>("call");
  const [actionDate, setActionDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [editKind, setEditKind] = React.useState<LoggedActionKind>("call");
  const [editDate, setEditDate] = React.useState("");
  const [editNote, setEditNote] = React.useState("");
  const formId = `logged-${"applicationId" in subject ? subject.applicationId : subject.memberId}`;
  const active = actions.filter((a) => !a.removed_at).length;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (kind === "other" && !note.trim()) return;
    add.mutate({ ...subject, kind, actionDate, note } as LoggedActionInput, {
      onSuccess: () => { setNote(""); setKind("call"); },
    });
  };
  const startEdit = (a: LoggedAction) => {
    setEditing(a.id);
    setEditKind(a.kind);
    setEditDate(a.action_date);
    setEditNote(a.note);
    edit.reset();
  };
  return (
    <Disclosure label={`Logged actions (${active})`}>
      <div className="flex flex-col gap-3 border-t border-app-rule px-3.5 py-3.5">
        {actions.map((a) => (
          <div key={a.id} className={cn("flex flex-col gap-1", a.removed_at && "opacity-60")}>
            {editing === a.id ? (
              <form className="flex flex-col gap-2" onSubmit={(e) => {
                e.preventDefault();
                edit.mutate({ id: a.id, kind: editKind, actionDate: editDate, note: editNote }, { onSuccess: () => setEditing(null) });
              }}>
                <label htmlFor={`${formId}-edit-kind-${a.id}`} className={meta}>Type</label>
                <select id={`${formId}-edit-kind-${a.id}`} value={editKind} onChange={(e) => setEditKind(e.currentTarget.value as LoggedActionKind)} className={fieldClass}>
                  {LOGGED_ACTION_KINDS.map((k) => <option key={k} value={k}>{LOGGED_ACTION_LABELS[k]}</option>)}
                </select>
                <label htmlFor={`${formId}-edit-date-${a.id}`} className={meta}>Date</label>
                <input id={`${formId}-edit-date-${a.id}`} type="date" required value={editDate} onChange={(e) => setEditDate(e.currentTarget.value)} className={fieldClass} />
                <label htmlFor={`${formId}-edit-note-${a.id}`} className={meta}>Note{editKind === "other" ? " (required)" : ""}</label>
                <textarea id={`${formId}-edit-note-${a.id}`} rows={2} maxLength={1000} value={editNote} onChange={(e) => setEditNote(e.currentTarget.value)} className={fieldClass} />
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className={secondaryButton} disabled={edit.isPending || (editKind === "other" && !editNote.trim())}>Save</button>
                  <button type="button" className={secondaryButton} onClick={() => setEditing(null)}>Cancel</button>
                </div>
                <MutationError mutation={edit} />
              </form>
            ) : (
              <>
                <p className="text-sm break-words text-ink">
                  <span className="font-medium">{LOGGED_ACTION_LABELS[a.kind]}</span>
                  {" · "}{a.action_date}
                  {a.note ? ` — ${a.note}` : ""}
                  {a.removed_at ? " (removed)" : ""}
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className={meta}>{a.author_name ?? "An admin"} · logged {formatDate(a.created_at)}</p>
                  {!a.removed_at && (
                    <>
                      <button type="button" className={cn("text-[13px] text-app-muted underline", ring)} disabled={edit.isPending}
                        aria-label={`Edit this ${LOGGED_ACTION_LABELS[a.kind]} for ${name}`} onClick={() => startEdit(a)}>
                        Edit
                      </button>
                      <button type="button" className={cn("text-[13px] text-app-muted underline", ring)} disabled={remove.isPending}
                        aria-label={`Remove this ${LOGGED_ACTION_LABELS[a.kind]} for ${name}`}
                        onClick={() => { if (window.confirm("Remove this logged action?")) remove.mutate(a.id); }}>
                        Remove
                      </button>
                    </>
                  )}
                  {a.removed_at && (
                    <button type="button" className={cn("text-[13px] text-app-muted underline", ring)} disabled={restore.isPending}
                      aria-label={`Restore this ${LOGGED_ACTION_LABELS[a.kind]} for ${name}`} onClick={() => restore.mutate(a.id)}>
                      Restore
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
        <form onSubmit={submit} className="flex flex-col gap-2">
          <p className={meta}>Log something done outside the app about {name}</p>
          <label htmlFor={`${formId}-kind`} className={meta}>Type</label>
          <select id={`${formId}-kind`} value={kind} onChange={(e) => setKind(e.currentTarget.value as LoggedActionKind)} className={fieldClass}>
            {LOGGED_ACTION_KINDS.map((k) => <option key={k} value={k}>{LOGGED_ACTION_LABELS[k]}</option>)}
          </select>
          <label htmlFor={`${formId}-date`} className={meta}>Date</label>
          <input id={`${formId}-date`} type="date" required value={actionDate} onChange={(e) => setActionDate(e.currentTarget.value)} className={fieldClass} />
          <label htmlFor={`${formId}-note`} className={meta}>Note{kind === "other" ? " (required)" : ""}</label>
          <textarea id={`${formId}-note`} rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.currentTarget.value)} className={fieldClass} />
          <div><button type="submit" className={secondaryButton} disabled={add.isPending || (kind === "other" && !note.trim())}>Log action</button></div>
        </form>
        <MutationError mutation={add} />
        <MutationError mutation={remove} />
        <MutationError mutation={restore} />
      </div>
    </Disclosure>
  );
}

// ---------- Inbox ----------

export function InboxPanel({ query = "" }: { query?: string }) {
  const inbox = useQuery(adminInboxQuery);
  const all = inbox.data ?? [];
  const list = all.filter((m) => matchesSearch(query, [m.name, m.email, m.business]));
  return (
    <Card id="inbox" title="Inbox" subtitle={inbox.data ? `${shownOf(list.length, all.length)}${all.length} waiting · contact messages and partnership inquiries` : "Contact messages and partnership inquiries"}>
      <QueryGate query={inbox} what="messages">
        {list.length === 0 ? <Empty>{all.length ? "No messages match." : "Nothing waiting."}</Empty> : list.map((m) => <InboxRow key={m.id} message={m} />)}
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
      <Disclosure label="Message">
        <p className="border-t border-app-rule px-3.5 py-3.5 text-sm break-words whitespace-pre-line text-ink">{m.message}</p>
      </Disclosure>
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

/** Approve / Decline always; Undo decline only when she is declined (CRM-069 / CRM-071 / CRM-174). */
function reviewOptions(current: string) {
  const options: { status: "pending" | "approved" | "declined"; label: string }[] = [
    { status: "approved", label: "Approve" },
    { status: "declined", label: "Decline" },
  ];
  if (current === "declined") options.push({ status: "pending", label: "Undo decline" });
  return options;
}

// ---------- Applications ----------

export function ApplicationsPanel({ query = "" }: { query?: string }) {
  const apps = useQuery(adminApplicationsQuery);
  const members = useQuery(adminMembersQuery);
  const notes = useQuery(adminNotesQuery);
  const logged = useQuery(adminLoggedActionsQuery);
  const [status, setStatus] = React.useState("");
  const all = apps.data ?? [];
  const list = all.filter((a) => (!status || (status === DUPLICATES ? a.duplicate !== null : a.status === status))
    && matchesSearch(query, [a.full_name, a.email, typeof a.answers.business === "string" ? a.answers.business : null]));
  const pending = all.filter((a) => a.status === "pending").length;
  const duplicates = all.filter((a) => a.duplicate).length;
  return (
    <Card id="applications" title="Applications" action={<CsvButton kind="applications" />}
      subtitle={apps.data ? `${shownOf(list.length, all.length)}${pending} pending${duplicates ? ` · ${duplicates} possible ${duplicates === 1 ? "duplicate" : "duplicates"}` : ""} · ${all.length} in total` : "Who has asked to join"}>
      <QueryGate query={apps} what="applications">
        <div className={cn(pad, "py-4")}>
          <FilterSelect id="applications-status" label="Status" value={status} options={APPLICATION_FILTER} onChange={setStatus} />
        </div>
        <NamesError members={members} />
        {notes.isError && <InlineError message="We couldn’t load notes right now." onRetry={() => void notes.refetch()} />}
        {logged.isError && <InlineError message="We couldn’t load logged actions right now." onRetry={() => void logged.refetch()} />}
        {list.length === 0
          ? <Empty>{all.length ? "No applications match." : "No applications yet."}</Empty>
          : list.map((app) => (
            <ApplicationRow key={app.id} app={app} members={members.data ?? []} notes={notesFor(notes.data, "application_id", app.id)}
              actions={actionsFor(logged.data, "application_id", app.id)} />
          ))}
      </QueryGate>
    </Card>
  );
}

function ApplicationRow({ app, members, notes, actions }: {
  app: AdminApplication; members: AdminMember[]; notes: AdminNote[]; actions: LoggedAction[];
}) {
  const review = useReviewApplication();
  const by = reviewerName(app.reviewed_by, members);
  const answers = formatAnswers(app.answers);
  return (
    <Item
      headingId={`application-${app.id}`} title={app.full_name} status={app.status}
      details={<>
        <p className={cn(meta, "break-words")}>{app.email} · {app.neighborhood || "No neighborhood given"} · Submitted {formatDate(app.created_at)}</p>
        <p className={meta}>{applicationOrigin(app.answers)} · {app.user_id ? "Linked to an account" : "No account yet"}</p>
      </>}
    >
      {app.duplicate && (
        <div className="flex flex-wrap items-center gap-2.5">
          <Chip tone="pending">Possible duplicate</Chip>
          <p className={meta}>{DUPLICATE_TEXT[app.duplicate]}. Check before approving.</p>
        </div>
      )}
      {app.status !== "pending" && (
        <p className={meta}>{humanizeKey(app.status)} {formatDate(app.reviewed_at)}{by && ` by ${by}`}</p>
      )}
      {answers.length > 0 && (
        <Disclosure label={`Answers (${answers.length})`}>
          <AnswerList entries={answers} />
        </Disclosure>
      )}
      <Notes subject={{ applicationId: app.id }} name={app.full_name} notes={notes} />
      <LoggedActions subject={{ applicationId: app.id }} name={app.full_name} actions={actions} />
      <MutationError mutation={review} />
      <EmailNotice notice={review.data} />
      <Decisions
        current={app.status}
        options={reviewOptions(app.status)}
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

export function MembersPanel({ query = "" }: { query?: string }) {
  const members = useQuery(adminMembersQuery);
  const links = useQuery(reviewLinkStatesQuery);
  const spotlightLinks = useQuery(spotlightLinkStatesQuery);
  const notes = useQuery(adminNotesQuery);
  const logged = useQuery(adminLoggedActionsQuery);
  const apps = useQuery(adminApplicationsQuery);
  const [status, setStatus] = React.useState("");
  const [hood, setHood] = React.useState("");
  const all = members.data ?? [];
  const appFor = React.useMemo(() => newestByUser(apps.data ?? []), [apps.data]);
  // The neighborhoods members actually have, so the filter never offers an empty choice.
  const hoods = [...new Set(all.map((m) => m.neighborhood).filter((n): n is string => !!n))].sort((a, b) => a.localeCompare(b));
  const list = all.filter((m) => (!status || m.status === status)
    && (!hood || (hood === NO_HOOD ? !m.neighborhood : m.neighborhood === hood))
    && matchesSearch(query, [m.full_name, m.email, m.business]));
  return (
    <Card id="members" title="All members" action={<CsvButton kind="members" />}
      subtitle={members.data ? `${shownOf(list.length, all.length)}${all.length} profiles · approve or decline directly` : "Every member profile"}>
      <QueryGate query={members} what="members">
        <div className={cn(pad, "flex flex-wrap gap-4 py-4")}>
          <FilterSelect id="members-status" label="Status" value={status} options={STATUS_FILTER} onChange={setStatus} />
          <FilterSelect id="members-hood" label="Neighborhood" value={hood} onChange={setHood}
            options={[{ value: "", label: "Any neighborhood" }, ...hoods.map((n) => ({ value: n, label: n })), { value: NO_HOOD, label: "No neighborhood" }]} />
        </div>
        {links.isError && <InlineError message="We couldn’t load review links right now." onRetry={() => void links.refetch()} />}
        {spotlightLinks.isError && <InlineError message="We couldn’t load Spotlight links right now." onRetry={() => void spotlightLinks.refetch()} />}
        {notes.isError && <InlineError message="We couldn’t load notes right now." onRetry={() => void notes.refetch()} />}
        {logged.isError && <InlineError message="We couldn’t load logged actions right now." onRetry={() => void logged.refetch()} />}
        {apps.isError && <InlineError message="We couldn’t load applications right now." onRetry={() => void apps.refetch()} />}
        {list.length === 0 ? <Empty>{all.length ? "No members match." : "No member profiles yet."}</Empty> : (
          // `relative` contains the sr-only (absolute) caption and header, or they escape the scroll clip and widen the page.
          <div role="region" aria-label="Members" tabIndex={0} className="relative overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-app-accent">
            <table className="w-full min-w-[60rem] text-left text-[15px]">
              <caption className="sr-only">Every member profile</caption>
              <thead>
                <tr className="border-b border-app-rule">
                  {["Name", "Status", "Neighborhood", "Listed", "Public", "Catalogue", "Email"].map((h) => <th key={h} scope="col" className={headCell}>{h}</th>)}
                  <th scope="col" className={headCell}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>{list.map((m) => (
                <MemberRow key={m.id} member={m} link={links.data?.[m.id] ?? null} spotlight={spotlightLinks.data?.[m.id] ?? null}
                  notes={notesFor(notes.data, "member_id", m.id)} actions={actionsFor(logged.data, "member_id", m.id)} app={appFor.get(m.id) ?? null} />
              ))}</tbody>
            </table>
          </div>
        )}
      </QueryGate>
    </Card>
  );
}

function MemberRow({ member, link, spotlight, notes, actions, app }: {
  member: AdminMember; link: LinkState | null; spotlight: LinkState | null; notes: AdminNote[]; actions: LoggedAction[]; app: AdminApplication | null;
}) {
  const setStatus = useSetMemberStatus();
  const name = member.full_name || "Unnamed member";
  return (
    <tr className="border-b border-app-rule align-top last:border-0">
      <th scope="row" className={cn(cell, "font-medium text-ink")}>{name}</th>
      <td className={cell}><StatusChip status={member.status} /></td>
      <td className={cell}>{member.neighborhood ?? "—"}</td>
      <td className={cell}>{member.directory_visible ? "Yes" : "No"}</td>
      <td className={cell}>{member.public_profile ? "Yes" : "No"}</td>
      <td className={cn(cell, "twc-index whitespace-nowrap")}>{member.catalogue_number === null ? "—" : `Nº ${String(member.catalogue_number).padStart(3, "0")}`}</td>
      <td className={cn(cell, "break-all")}>{member.email ?? "—"}</td>
      <td className={cell}>
        <div className="flex flex-col gap-2">
          <Decisions
            current={member.status}
            options={reviewOptions(member.status)}
            subject={name}
            pending={setStatus.isPending}
            onDecide={(status) => setStatus.mutate({ id: member.id, status })}
          />
          <MutationError mutation={setStatus} />
          <EmailNotice notice={setStatus.data} />
          {member.status === "approved" && <ReviewLink memberId={member.id} name={name} link={link} />}
          {member.status === "approved" && <ReviewLink purpose="spotlight" memberId={member.id} name={name} link={spotlight} />}
          <MemberDetails member={member} name={name} app={app} actions={actions} />
          <Notes subject={{ memberId: member.id }} name={name} notes={notes} />
        </div>
      </td>
    </tr>
  );
}

const NO_HOOD = " none"; // names are saved trimmed, so this is never one

/**
 * CRM-060 in the row: her neighborhood (CRM-059 — an admin's correction changes the profile, never the answer she
 * gave), logged actions (CRM-057) and her newest application's answers, without leaving the card.
 */
function MemberDetails({ member, name, app, actions }: {
  member: AdminMember; name: string; app: AdminApplication | null; actions: LoggedAction[];
}) {
  const save = useSetMemberNeighborhood();
  const { data: hoodList = [] } = useNeighborhoods();
  const [hood, setHood] = React.useState(member.neighborhood ?? "");
  const answers = app ? formatAnswers(app.answers) : [];
  const id = `hood-${member.id}`;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({ id: member.id, neighborhood: hood || null });
  };
  return (
    <Disclosure label="Details">
      <ul aria-label={`Summary for ${name}`} className="flex flex-wrap gap-2 border-t border-app-rule px-3.5 py-3.5">
        <li><Chip>{newsletterLabel(member.newsletter)}</Chip></li>
        <li><Chip>{member.applications === 1 ? "1 application" : `${member.applications} applications`}</Chip></li>
        <li><Chip>{member.member_since ? `Member since ${formatDate(member.member_since)}` : "Not a member yet"}</Chip></li>
      </ul>
      <form onSubmit={submit} className="flex flex-col gap-2 border-t border-app-rule px-3.5 py-3.5">
        <label htmlFor={id} className={meta}>Neighborhood for {name}</label>
        <div className="flex flex-wrap gap-2">
          <select id={id} value={hood} onChange={(e) => { save.reset(); setHood(e.currentTarget.value); }} className={cn(fieldClass, "min-w-0 flex-1")}>
            <option value="">No neighborhood</option>
            {pickerNames(hoodList, member.neighborhood ?? []).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button type="submit" className={secondaryButton} disabled={save.isPending || hood === (member.neighborhood ?? "")}>Save</button>
        </div>
        {save.isSuccess && <p role="status" className={meta}>Saved</p>}
        <MutationError mutation={save} />
      </form>
      <div className="border-t border-app-rule px-3.5 py-3.5">
        <LoggedActions subject={{ memberId: member.id }} name={name} actions={actions} />
      </div>
      <p className={cn(meta, "border-t border-app-rule px-3.5 py-3.5")}>
        {app
          ? `Applied ${formatDate(app.created_at)} · ${humanizeKey(app.status)} · ${applicationOrigin(app.answers)}${app.neighborhood ? ` · Neighborhood given: ${app.neighborhood}` : ""}`
          : "No application linked to this account."}
      </p>
      {answers.length > 0 && <AnswerList entries={answers} />}
    </Disclosure>
  );
}

// ---------- Newsletter subscribers (CRM-093) ----------

/** Read-only list of newsletter_subscribers; page search filters it. No Beehiiv write from here. */
export function NewsletterPanel({ query = "" }: { query?: string }) {
  const subs = useQuery(adminNewsletterQuery);
  const all = subs.data ?? [];
  const list = all.filter((s) => matchesSearch(query, [s.email, s.full_name, s.source]));
  return (
    <Card id="newsletter" title="Newsletter" subtitle={subs.data ? `${shownOf(list.length, all.length)}${all.length} sign-ups · website and imported Beehiiv list` : "Newsletter sign-ups"}>
      <QueryGate query={subs} what="newsletter subscribers">
        {list.length === 0
          ? <Empty>{all.length ? "No subscribers match." : "No newsletter sign-ups yet."}</Empty>
          : list.map((s) => (
            <article key={s.id} className={cn(pad, "border-b border-app-rule py-4 last:border-0")}>
              <h3 className="text-[15px] font-medium break-words text-ink">{s.email}</h3>
              <p className={cn(meta, "mt-1 break-words")}>
                {subscriberConsentLabel(s.consent)}
                {s.source ? ` · ${s.source === "beehiiv" ? "Beehiiv" : "Website"}` : ""}
                {" · "}{formatDate(s.subscribed_at)}
                {s.full_name ? ` · ${s.full_name}` : ""}
              </p>
            </article>
          ))}
      </QueryGate>
    </Card>
  );
}

// ---------- Admin activity (0007) ----------

/** Who approved, declined, noted or moved whom: the newest 100, newest first. Read-only, like the table. */
export function ActivityPanel() {
  const actions = useQuery(adminActionsQuery);
  const list = actions.data ?? [];
  return (
    <Card id="activity" title="Admin activity" subtitle="The newest approvals, declines, notes and neighborhood changes">
      <QueryGate query={actions} what="admin activity">
        {list.length === 0 ? <Empty>Nothing recorded yet.</Empty> : (
          <ol className="flex flex-col">
            {list.map((a) => (
              <li key={a.id} className={cn(pad, "border-b border-app-rule py-3 text-sm break-words text-ink last:border-0")}>
                <span className="font-medium">{a.actor_name ?? "A removed admin"}</span> {describeAction(a)}
                <span className={meta}> · {formatDate(a.created_at)}</span>
              </li>
            ))}
          </ol>
        )}
      </QueryGate>
    </Card>
  );
}

const LINK_STATE: Record<LinkState["state"], (l: LinkState, kind: string) => string> = {
  active: (l, kind) => `${kind} open until ${formatDate(l.expires_at)}`,
  used: (l, kind) => `${kind} used ${formatDate(l.used_at)}`,
  expired: (l, kind) => `${kind} closed ${formatDate(l.expires_at)}`,
};
const LINK_WORDS: Record<Purpose, { kind: string; make: string; again: string; revoke: string }> = {
  review: { kind: "Review link", make: "Make review link", again: "New review link", revoke: "review link" },
  // CRM-083: the old CRM's "Invite to Spotlight".
  spotlight: { kind: "Spotlight link", make: "Invite to Spotlight", again: "New Spotlight link", revoke: "Spotlight link" },
};

/**
 * A personal review or Spotlight link (CRM-082–089, CRM-083): its state, Make / Revoke, and the new URL shown once
 * to copy into the admin's own message. Only its hash is stored, so a lost URL means making a new one (which closes the old).
 */
function ReviewLink({ memberId, name, link, purpose = "review" }: { memberId: string; name: string; link: LinkState | null; purpose?: Purpose }) {
  const mint = useMintReviewLink(purpose);
  const revoke = useRevokeReviewLink(purpose);
  const words = LINK_WORDS[purpose];
  const inputId = `${purpose}-link-${memberId}`;
  const [copied, setCopied] = React.useState(false);
  const busy = mint.isPending || revoke.isPending;
  const copy = (url: string) => navigator.clipboard?.writeText(url).then(() => setCopied(true), () => setCopied(false));
  return (
    <div className="flex flex-col gap-2 border-t border-app-rule pt-2">
      {link && <p className={meta}>{LINK_STATE[link.state](link, words.kind)}</p>}
      <div className="flex flex-wrap gap-2.5">
        <button type="button" className={secondaryButton} aria-label={`Make a ${words.revoke} for ${name}`} disabled={busy}
          onClick={() => { setCopied(false); revoke.reset(); mint.mutate(memberId); }}>
          {link?.state === "active" ? words.again : words.make}
        </button>
        {link?.state === "active" && (
          <button type="button" className={secondaryButton} aria-label={`Revoke the ${words.revoke} for ${name}`} disabled={busy}
            onClick={() => { mint.reset(); revoke.mutate(memberId); }}>
            Revoke
          </button>
        )}
      </div>
      <MutationError mutation={mint} />
      <MutationError mutation={revoke} />
      {mint.data && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className={meta}>Shown once — copy it into your own message to {name}. Opens one time, until {formatDate(mint.data.expires_at)}.</label>
          <div className="flex gap-2">
            <input id={inputId} readOnly value={mint.data.url} className={cn(fieldClass, "min-w-0 flex-1")} onFocus={(e) => e.currentTarget.select()} />
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

// ---------- Spotlight answers ----------

/** CRM-037 / CRM-097: every Weekly Spotlight answer, sent through a link or imported from the old sheet. Nothing is published from here. */
export function SpotlightPanel() {
  const spotlights = useQuery(adminSpotlightsQuery);
  const list = spotlights.data ?? [];
  return (
    <Card id="spotlight" title="Spotlight answers" subtitle={spotlights.data ? `${list.length} answers · from personal Spotlight links and the old sheet` : "Answers from personal Spotlight links"}>
      <QueryGate query={spotlights} what="Spotlight answers">
        {list.length === 0 ? <Empty>No Spotlight answers yet.</Empty> : list.map((s) => <SpotlightRow key={s.id} spotlight={s} />)}
      </QueryGate>
    </Card>
  );
}

function SpotlightRow({ spotlight: s }: { spotlight: AdminSpotlight }) {
  const entries = spotlightEntries(s.answers);
  const about = [s.business, s.neighborhood].filter(Boolean).join(" · ");
  return (
    <Item
      headingId={`spotlight-${s.id}`} title={s.full_name} status={s.imported ? "imported" : "sent"}
      details={<p className={meta}>{about && `${about} · `}{s.imported ? "Added" : "Sent"} {formatDate(s.created_at)}</p>}
    >
      <details className="group rounded-md bg-app-sunken">
        <summary className={cn("flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md px-3.5 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden", ring)}>
          <Icon name="chevron-down" className="size-3.25 -rotate-90 text-app-muted transition-transform group-open:rotate-0 motion-reduce:transition-none" />
          Answers ({entries.length})
        </summary>
        <AnswerList entries={entries} />
      </details>
    </Item>
  );
}

// ---------- Form responses (CRM-099/100/103 light + CRM-130) ----------

export function FormResponsesPanel() {
  const forms = useQuery(adminFormResponsesQuery);
  const list = forms.data ?? [];
  const total = list.reduce((n, f) => n + f.total, 0);
  return (
    <Card id="forms" title="Form responses" subtitle={forms.data ? `${total} answers · ${list.length} forms at /f/…` : "Answers to the forms at /f/…"}>
      <QueryGate query={forms} what="form responses">
        {list.length === 0 ? <Empty>No forms yet.</Empty> : list.map((f) => <FormRow key={f.id} form={f} />)}
      </QueryGate>
    </Card>
  );
}

function FormRow({ form: f }: { form: AdminForm }) {
  const setOpen = useSetFormOpen();
  const csv = useDownloadFormCsv();
  const [message, setMessage] = React.useState(f.closed_message);
  React.useEffect(() => { setMessage(f.closed_message); }, [f.closed_message]);
  const shown = f.total > f.responses.length ? ` · newest ${f.responses.length} shown` : "";
  const newest = f.newest_at ? ` · newest ${formatDate(f.newest_at)}` : "";
  const busy = setOpen.isPending || csv.isPending;
  const closeForm = () => {
    if (!window.confirm(`Close “${f.name}”? Visitors will see the closed message instead of the form.`)) return;
    setOpen.mutate({ id: f.id, open: false, message });
  };
  return (
    <Item headingId={`form-${f.id}`} title={f.name} status={f.open ? "open" : "closed"}
      details={<p className={meta}>
        <a className={cn("underline", ring)} href={`/f/${f.slug}`}>/f/{f.slug}</a>
        {" · "}{f.total === 1 ? "1 answer" : `${f.total} answers`}{newest}{shown}
      </p>}>
      <div className="flex flex-col gap-3 rounded-md bg-app-sunken p-3.5">
        <Field id={`form-closed-${f.id}`} label="Closed message" hint="Shown on /f/… when the form is closed (up to 1,000 characters).">
          <input id={`form-closed-${f.id}`} value={message} maxLength={1000} disabled={busy}
            aria-describedby={`form-closed-${f.id}-hint`}
            onChange={(e) => setMessage(e.currentTarget.value)} className={fieldClass} />
        </Field>
        <div className="flex flex-wrap gap-2.5">
          {f.open
            ? <button type="button" className={secondaryButton} disabled={busy} aria-label={`Close ${f.name}`} onClick={closeForm}>Close form</button>
            : <>
                <button type="button" className={primaryButton} disabled={busy} aria-label={`Open ${f.name}`}
                  onClick={() => setOpen.mutate({ id: f.id, open: true })}>Open form</button>
                <button type="button" className={secondaryButton} disabled={busy || message === f.closed_message}
                  aria-label={`Update closed message for ${f.name}`}
                  onClick={() => setOpen.mutate({ id: f.id, open: false, message })}>Update closed message</button>
              </>}
          {f.total > 0 && (
            <button type="button" className={secondaryButton} disabled={busy}
              aria-label={`Download CSV of ${f.name}`} onClick={() => csv.mutate(f.id)}>
              Download CSV
            </button>
          )}
        </div>
        <MutationError mutation={setOpen} />
        <MutationError mutation={csv} />
      </div>
      {f.responses.map((r) => (
        <details key={r.id} className="group rounded-md bg-app-sunken">
          <summary className={cn("flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md px-3.5 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden", ring)}>
            <Icon name="chevron-down" className="size-3.25 -rotate-90 text-app-muted transition-transform group-open:rotate-0 motion-reduce:transition-none" />
            {formatDate(r.created_at)} ({r.entries.length} answers)
          </summary>
          <AnswerList entries={r.entries} />
        </details>
      ))}
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
