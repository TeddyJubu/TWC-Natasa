// The /admin cards (sidebar anchors). Data and rules live in ./queries, ./mutations and ./format; these only render.
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { cn, initials } from "@/index";
import { fieldClass, linkClass, primaryButton, ring, secondaryButton } from "@/app/layout/app-classes";
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
  reviewerName, answerTitle, FORM_TABS, NO_NAME, type AnswerEntry, type FormTab, type LoggedActionKind,
} from "./format";
import {
  adminReviewsQuery, adminSpotlightsQuery, reviewLinkStatesQuery, spotlightLinkStatesQuery, useMarkReviewDone, useMintReviewLink, useRevokeReviewLink,
  type AdminReview, type AdminSpotlight, type LinkState, type Purpose,
} from "@/features/member-links/queries";
import { reviewEntries } from "@/features/member-links/schema";
import { spotlightEntries } from "@/features/member-links/spotlight";
import { QuestionsEditor } from "@/features/forms/FormEditor";
import { draftFromQuestions, questionsFromDraft, starterQuestions } from "@/features/forms/form-draft";
import type { SaveAdminFormInput } from "@/features/forms/fns";
import { adminFormResponsesQuery, useDeleteAdminForm, useDownloadFormCsv, useSaveAdminForm, useSetFormOpen, type AdminForm } from "@/features/forms/queries";
import { BUILT_IN, BUILT_IN_INFO, COPY_FIELDS, COPY_MAX, LONG_TEXT, isCopyForm, type BuiltIn, type CopyForm } from "@/features/form-copy/manifest";
import { adminFormCopyQuery, useSaveFormCopy } from "@/features/form-copy/queries";
import { adminFormsStateQuery, useSetMembershipFormOpen } from "@/features/forms-state/queries";

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

/** Waiting on an admin (pending, requested) in sun; approved/confirmed in mint; an open form in blue gel, an always-on one in green gel; declined in danger. */
const STATUS_TONE: Record<string, ChipTone> = { pending: "pending", requested: "pending", approved: "ok", confirmed: "ok", open: "gel", always_on: "gel-green", declined: "no" };
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
/** Inbox triage (CRM-063): Needs attention = status new; Archived lists what archive already wrote. No Spam view. */
const INBOX_FILTER: Option[] = [
  { value: "new", label: "Needs attention" },
  { value: "archived", label: "Archived" },
];

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
  const [status, setStatus] = React.useState<"new" | "archived">("new");
  const loaded = inbox.data ?? [];
  const inView = loaded.filter((m) => m.status === status);
  const list = inView.filter((m) => matchesSearch(query, [m.name, m.email, m.business]));
  const waiting = loaded.filter((m) => m.status === "new").length;
  const archived = loaded.filter((m) => m.status === "archived").length;
  const subtitle = inbox.data
    ? `${shownOf(list.length, inView.length)}${status === "new" ? `${waiting} waiting` : `${archived} archived`} · contact messages and partnership inquiries`
    : "Contact messages and partnership inquiries";
  return (
    <Card id="inbox" title="Inbox" subtitle={subtitle}>
      <QueryGate query={inbox} what="messages">
        <div className={cn(pad, "py-4")}>
          <FilterSelect id="inbox-status" label="View" value={status} options={INBOX_FILTER}
            onChange={(v) => setStatus(v === "archived" ? "archived" : "new")} />
        </div>
        {list.length === 0
          ? <Empty>{inView.length ? "No messages match." : status === "new" ? "Nothing waiting." : "Nothing archived."}</Empty>
          : list.map((m) => <InboxRow key={m.id} message={m} />)}
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
      {m.status === "new" && (
        <>
          <MutationError mutation={archive} />
          <div>
            <button type="button" className={secondaryButton} aria-label={`Archive the message from ${m.name}`} disabled={archive.isPending}
              onClick={() => archive.mutate(m.id)}>
              Archive
            </button>
          </div>
        </>
      )}
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

// ---------- Forms: the list, and each form's own edit page ----------

const formPath = (slug: string) => `/f/${slug}`;

/** Copies a site link, then says so (or shows the link to copy by hand). */
function CopyLink({ path }: { path: string }) {
  const [state, setState] = React.useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      setState("copied");
    } catch {
      setState("failed");
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2.5">
      <button type="button" className={secondaryButton} onClick={() => void copy()}><Icon name="copy" className="size-4" />Copy link</button>
      <span role="status" className="text-[13px] text-app-muted">{state === "copied" ? "Copied" : state === "failed" ? `Couldn’t copy. The link is ${path}` : ""}</span>
    </span>
  );
}

/** A public page link that opens in a new tab, so the admin page stays put. */
function PublicLink({ href }: { href: string }) {
  return (
    <a className={cn(linkClass, "inline-flex items-center gap-1.5")} href={href} target="_blank" rel="noreferrer">
      {href}<Icon name="external-link" className="size-3.5" /><span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * The one open/closed control for a form, and its closed message. Closing asks first. Each form has exactly one of
 * these, so nothing else on the page can reopen a form behind it.
 */
function OpenSwitch({ idPrefix, name, open, savedMessage, hint, busy, error, onSet }: {
  idPrefix: string; name: string; open: boolean; savedMessage: string; hint: string; busy: boolean; error: React.ReactNode;
  onSet: (open: boolean, message: string) => void;
}) {
  const [message, setMessage] = React.useState(savedMessage);
  React.useEffect(() => { setMessage(savedMessage); }, [savedMessage]);
  const toggle = (next: boolean) => {
    if (!next && !window.confirm(`Close “${name}”? Visitors will see the closed message instead of the form.`)) return;
    onSet(next, message);
  };
  return (
    <>
      <Toggle label="Open for answers" checked={open} disabled={busy} onChange={(e) => toggle(e.currentTarget.checked)}
        description={open ? "Visitors can fill it in now. Switch off to close it." : "Closed. Visitors see the closed message below."} />
      <div className={cn(pad, "flex flex-col gap-3 py-5")}>
        <Field id={`${idPrefix}-closed`} label="Closed message" hint={hint}>
          <input id={`${idPrefix}-closed`} value={message} maxLength={1000} disabled={busy} aria-describedby={`${idPrefix}-closed-hint`}
            onChange={(e) => setMessage(e.currentTarget.value)} className={fieldClass} />
        </Field>
        {message !== savedMessage && (
          <div className="flex flex-wrap gap-2.5">
            <button type="button" className={secondaryButton} disabled={busy} onClick={() => onSet(open, message)}>Save closed message</button>
            <button type="button" className={secondaryButton} disabled={busy} onClick={() => setMessage(savedMessage)}>Undo</button>
          </div>
        )}
        {error}
      </div>
    </>
  );
}

/**
 * The kit's admit ticket on the app palette: a paper card whose stub tears off along a dashed line, with a punched
 * notch at each end of the tear. `row` puts the stub beside the main part from sm; otherwise it sits underneath.
 * `label` makes it a named region; `stamp` swaps the hairline outline for the postage edge (twc-stamp-edge).
 */
function Ticket({ label, row, stamp, stub, className, children }: { label?: string; row?: boolean; stamp?: boolean; stub: React.ReactNode; className?: string; children: React.ReactNode }) {
  const Tag = label ? "section" : "div";
  const line = "shadow-[inset_0_0_0_1px_var(--color-app-line)]";
  const notch = cn("absolute size-4 rounded-full bg-app-sunken", !stamp && line);
  return (
    <Tag aria-label={label} className={cn("relative flex flex-col overflow-hidden bg-app", stamp ? "twc-stamp-edge" : cn("rounded-md", line), row && "sm:flex-row", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5 sm:p-6">{children}</div>
      <div className={cn("relative flex shrink-0 flex-col justify-center border-t border-dashed border-app-muted/60 px-5 py-4 sm:px-6", row && "sm:w-56 sm:border-t-0 sm:border-l sm:py-6")}>
        <span aria-hidden className={cn(notch, "top-0 left-0 -translate-1/2")} />
        <span aria-hidden className={cn(notch, "top-0 right-0 translate-x-1/2 -translate-y-1/2", row && "sm:top-auto sm:right-auto sm:bottom-0 sm:left-0 sm:-translate-x-1/2 sm:translate-y-1/2")} />
        {stub}
      </div>
    </Tag>
  );
}

/**
 * One form as a ticket. The whole card opens its edit page (the heading's link stretches over it); `onDelete` adds a
 * trash button raised above that link.
 */
function FormCard({ id, title, status, where, note, stub, onDelete, deleting }: { id: string; title: string; status: string; where?: string; note?: string; stub: React.ReactNode; onDelete?: () => void; deleting?: boolean }) {
  const headingId = `form-card-${id}`;
  return (
    <article aria-labelledby={headingId}
      className="group relative rounded-md transition-transform duration-150 ease-snap hover:-translate-y-0.5 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-app-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <Ticket stamp className="h-full"
        stub={(
          <div className="flex items-center justify-between gap-3 text-[13px] text-app-muted">
            <span className="min-w-0">{stub}</span>
            <Icon name="arrow-right" className="size-4 text-ink transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </div>
        )}>
        <div className="flex items-start justify-between gap-3">
          <h3 id={headingId} className="min-w-0 font-geist font-medium text-[22px]/[1.2] break-words text-ink">
            <Link to="/admin/forms/$formId" params={{ formId: id }} className="outline-none after:absolute after:inset-0 after:content-['']">{title}</Link>
          </h3>
          <div className="flex shrink-0 items-center gap-1.5">
            <StatusChip status={status} />
            {onDelete && (
              <button type="button" aria-label={`Delete ${title}`} title="Delete" disabled={deleting} onClick={onDelete}
                className={cn("relative z-10 grid size-8 place-items-center rounded-full text-app-muted transition-colors hover:bg-app-sunken hover:text-ink disabled:opacity-50", ring)}>
                <Icon name="trash" className="size-4" />
              </button>
            )}
          </div>
        </div>
        {where && <p className="twc-index break-all">{where}</p>}
        {note && <p className={meta}>{note}</p>}
      </Ticket>
    </article>
  );
}

const cardGrid = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";
/** Built-in forms with a page to edit; the newsletter has none, so it is a note under them. */
const LISTED_BUILT_IN = BUILT_IN.filter((kind) => kind !== "newsletter");

function SectionHead({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 id={id} className="font-geist text-[21px]/[1.2] font-medium tracking-[-0.3px] text-ink">{title}</h2>
      <p className="text-sm text-app-muted">{children}</p>
    </div>
  );
}

/** Your own /f/… forms first (the ones you change), then the site's built-in forms. */
export function FormsListPanel() {
  const states = useQuery(adminFormsStateQuery);
  const forms = useQuery(adminFormResponsesQuery);
  const [adding, setAdding] = React.useState(false);
  const remove = useDeleteAdminForm();
  const tile = React.useRef<HTMLButtonElement>(null);
  const confirmDelete = (f: AdminForm) => {
    const answers = f.total === 0 ? "" : ` Its ${f.total === 1 ? "answer goes" : `${f.total} answers go`} with it; download the CSV first if you want to keep them.`;
    if (window.confirm(`Delete “${f.name}” for good?${answers} Its /f/${f.slug} link will stop working.`)) { remove.mutate(f.id); tile.current?.focus(); }
  };
  const custom = forms.data ?? [];
  const open = (kind: "application" | "review") => (states.data?.find((s) => s.kind === kind)?.open === false ? "closed" : "open");
  const status: Record<BuiltIn, string> = { application: open("application"), review: open("review"), contact: "always_on", partnership: "always_on", newsletter: "no_page" };
  const total = custom.reduce((n, f) => n + f.total, 0);
  const close = () => { setAdding(false); tile.current?.focus(); };
  return (
    <div id="forms" className="flex scroll-mt-28 flex-col gap-12">
      <section aria-labelledby="forms-yours" className="flex flex-col gap-4">
        <SectionHead id="forms-yours" title="Your forms">
          {forms.data && custom.length > 0
            ? `${custom.length === 1 ? "1 form" : `${custom.length} forms`} at /f/…, ${total === 1 ? "1 answer" : `${total} answers`} in all.`
            : "Forms you make, each at its own /f/… link: RSVPs, sign-ups, surveys."}
        </SectionHead>
        <QueryGate query={forms} what="your forms">
          <div className={cardGrid}>
            {custom.map((f) => (
              <FormCard key={f.id} id={f.id} title={f.name} status={f.open ? "open" : "closed"} where={formPath(f.slug)}
                onDelete={() => confirmDelete(f)} deleting={remove.isPending}
                stub={<><span className="font-geist text-lg/none text-ink tabular-nums">{f.total}</span> {f.total === 1 ? "answer" : "answers"}{f.newest_at ? ` · newest ${formatDate(f.newest_at)}` : ""}</>} />
            ))}
            <button ref={tile} type="button" aria-expanded={adding} aria-controls="forms-new" onClick={() => (adding ? close() : setAdding(true))}
              className={cn("group flex min-h-40 text-ink", ring)}>
              {/* The postage edge sits on an inner layer: a mask on the button would clip its focus outline too. */}
              <span className="twc-stamp-edge flex flex-1 flex-col items-center justify-center gap-3 bg-app/50 p-5 transition-colors duration-150 group-hover:bg-app group-aria-expanded:bg-app">
                <span aria-hidden className="grid size-11 place-items-center rounded-full bg-ink text-app transition-transform duration-150 ease-snap group-hover:scale-105 motion-reduce:transition-none"><Icon name="plus" className="size-5" /></span>
                <span className="font-geist text-[22px]/[1.2]">New form</span>
              </span>
            </button>
          </div>
          <MutationError mutation={remove} />
          {adding && <NewFormPanel onClose={close} />}
        </QueryGate>
      </section>
      <section aria-labelledby="forms-built-in" className="flex flex-col gap-4">
        <SectionHead id="forms-built-in" title="Built-in forms">The site’s own forms. Change their wording, or open and close the two that can close.</SectionHead>
        <div className={cardGrid}>
          {LISTED_BUILT_IN.map((kind) => {
            const info = BUILT_IN_INFO[kind];
            return <FormCard key={kind} id={kind} title={info.title} status={status[kind]} where={info.href}
              note={status[kind] === "always_on" ? undefined : info.note} stub={<>Answers in {info.answers[0]}</>} />;
          })}
        </div>
        <p className={meta}>
          Newsletter sign-ups come from the membership application’s opt-in; there is no separate form. See them in{" "}
          <a className={linkClass} href={BUILT_IN_INFO.newsletter.answers[1]}>{BUILT_IN_INFO.newsletter.answers[0]}</a>.
        </p>
      </section>
    </div>
  );
}

/** A link name from a form name: what checkQuestions' slug rules accept (a–z, 0–9, single hyphens, ≤ 40). */
const slugFrom = (name: string) =>
  name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").slice(0, 40).replace(/-+$/, "");

/** Name and web address only; the form is made closed with name + email questions, then opens on its Questions tab. */
function NewFormPanel({ onClose }: { onClose: () => void }) {
  const save = useSaveAdminForm();
  const navigate = useNavigate();
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState<string | null>(null);
  const address = slug ?? slugFrom(name);
  const first = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { first.current?.focus(); }, []);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(
      { name: name.trim(), slug: address, intro: "", thanks: "", closed_message: "", open: false, one_per_email: false, questions: starterQuestions() },
      { onSuccess: ({ id }) => { onClose(); void navigate({ to: "/admin/forms/$formId", params: { formId: id }, search: { tab: "questions" } }); } },
    );
  };
  return (
    <form id="forms-new" aria-label="New form" onSubmit={submit} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      className="flex flex-col gap-5 rounded-md bg-app p-5 shadow-[inset_0_0_0_1px_var(--color-app-line)] sm:p-7">
      <h3 className="font-geist font-medium text-[26px]/[1.2] text-ink">New form</h3>
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="form-new-name" label="Name">
          <input ref={first} id="form-new-name" required maxLength={80} value={name} disabled={save.isPending} placeholder="Supper club RSVP"
            onChange={(e) => setName(e.currentTarget.value)} className={fieldClass} />
        </Field>
        <Field id="form-new-slug" label="Web address" hint={`The form’s link: /f/${address || "…"}`}>
          <input id="form-new-slug" required maxLength={40} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={address} disabled={save.isPending}
            aria-describedby="form-new-slug-hint" onChange={(e) => setSlug(e.currentTarget.value)} className={fieldClass} />
        </Field>
      </div>
      <p className={meta}>It starts closed with two questions, your name and email, so nobody sees it until you open it in Settings.</p>
      <MutationError mutation={save} />
      <div className="flex flex-wrap gap-2.5">
        <button type="submit" className={primaryButton} disabled={save.isPending}>Create form</button>
        <button type="button" className={secondaryButton} disabled={save.isPending} onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

/** An edit page's way back to the list. */
export function BackToForms() {
  return (
    <Link to="/admin/forms" className={cn("inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-app-muted underline-offset-4 hover:text-ink hover:underline", ring)}>
      <Icon name="arrow-left" className="size-4" />Back to forms
    </Link>
  );
}

function NotFound() {
  return <Card id="form" title="Form not found"><Empty>There is no form with this address. It may have been renamed or removed.</Empty></Card>;
}

/** A form's state in a sentence, next to its chip. */
const STATUS_LINE: Record<string, string> = {
  open: "Visitors can fill it in now.", closed: "Visitors see your closed message.",
  always_on: "Always on; it can’t be closed.", no_page: "No public page yet.",
};

/** The edit page for a built-in form: where it lives, open/close (join and review), and its wording. */
export function BuiltInFormPanel({ kind }: { kind: BuiltIn }) {
  const info = BUILT_IN_INFO[kind];
  const states = useQuery(adminFormsStateQuery);
  const setOpen = useSetMembershipFormOpen();
  const state = states.data?.find((s) => s.kind === kind);
  const closable = kind === "application" || kind === "review";
  const status = closable ? (state?.open === false ? "closed" : "open") : kind === "newsletter" ? "no_page" : "always_on";
  return (
    <>
      <Ticket row label="Summary" stub={(
        <div className="flex flex-col gap-1.5">
          <p className="twc-eyebrow">Answers go to</p>
          <a className={cn(linkClass, "w-fit font-geist text-[22px]/[1.2] font-normal")} href={info.answers[1]}>{info.answers[0]}</a>
        </div>
      )}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <StatusChip status={status} />
          <p className="text-[15px] text-ink">{STATUS_LINE[status]}</p>
        </div>
        {info.href
          ? <div className="flex flex-wrap items-center gap-x-4 gap-y-2"><PublicLink href={info.href} /><CopyLink path={info.href} /></div>
          : <p className={meta}>{info.note}</p>}
      </Ticket>
      {closable && (
        <Card id="status" title="Open or closed" subtitle="When it’s closed, visitors see your closed message instead of the form.">
          <QueryGate query={states} what="the open/closed switch">
            {state
              ? <OpenSwitch idPrefix={`membership-${kind}`} name={info.title} open={state.open} savedMessage={state.message} busy={setOpen.isPending}
                  hint="Shown on the public page while it’s closed (up to 1,000 characters). Blank uses the default."
                  error={<MutationError mutation={setOpen} />} onSet={(open, message) => setOpen.mutate({ kind, open, message })} />
              : <Empty>No switch found for this form.</Empty>}
          </QueryGate>
        </Card>
      )}
      {isCopyForm(kind)
        ? <WordingPanel form={kind} />
        : <Card id="wording" title="Wording"><Empty>This form has no public page yet, so there is no wording to edit.</Empty></Card>}
    </>
  );
}

/** Every editable text of a built-in form, grouped as on the page. Blank restores the original. */
function WordingPanel({ form }: { form: CopyForm }) {
  const current = useQuery(adminFormCopyQuery(form));
  const save = useSaveFormCopy();
  return (
    <Card id="wording" title="Wording" subtitle="Change what visitors read. Clear a box to restore the original. Consent statements, answer choices and notices stay as written.">
      <QueryGate query={current} what="the wording">
        <WordingForm key={JSON.stringify(current.data)} form={form} current={current.data ?? {}} save={save} />
      </QueryGate>
    </Card>
  );
}

function WordingForm({ form, current, save }: { form: CopyForm; current: Record<string, string>; save: ReturnType<typeof useSaveFormCopy> }) {
  const fields = COPY_FIELDS[form];
  const saved = (text: string) => current[text] ?? text;
  const [draft, setDraft] = React.useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.text, saved(f.text)])));
  const unsaved = fields.filter((f) => draft[f.text] !== saved(f.text)).length;
  const groups = [...new Set(fields.map((f) => f.group))];
  React.useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
  return (
    <form aria-label="Wording" className="flex flex-col" onSubmit={(e) => { e.preventDefault(); save.mutate({ form, values: draft }); }}>
      {groups.map((group, gi) => {
        const inGroup = fields.filter((f) => f.group === group);
        const changed = inGroup.filter((f) => draft[f.text].trim() && draft[f.text] !== f.text).length;
        const headingId = `wording-${form}-group-${gi}`;
        return (
          <details key={group} open={gi === 0} className="group border-b border-app-rule">
            <summary className={cn("flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 sm:px-7 [&::-webkit-details-marker]:hidden", ring)}>
              <Icon name="chevron-down" className="size-3.5 -rotate-90 text-app-muted transition-transform group-open:rotate-0 motion-reduce:transition-none" />
              <h3 id={headingId} className="text-base font-medium text-ink">{group}</h3>
              <span className="ml-auto flex items-center gap-3">
                {changed > 0 && <Chip tone="pending">{changed} changed</Chip>}
                <span className={cn(meta, "max-sm:hidden")}>{inGroup.length} {inGroup.length === 1 ? "text" : "texts"}</span>
              </span>
            </summary>
            <section aria-labelledby={headingId} className="flex flex-col gap-4 px-5 pb-6 sm:px-7">
              {inGroup.map((f) => {
                const id = `wording-${form}-field-${fields.indexOf(f)}`;
                const isChanged = !!draft[f.text].trim() && draft[f.text] !== f.text;
                const hint = [f.text.includes("{name}") ? "{name} becomes the member’s first name." : "", isChanged ? "Changed from the original." : ""].filter(Boolean).join(" ");
                const props = { id, value: draft[f.text], maxLength: COPY_MAX, placeholder: f.text,
                  // A changed box wears a sun rule, so your own words stand out from the originals.
                  className: cn(fieldClass, isChanged && "shadow-[inset_0_0_0_2px_var(--color-app-pending)]"), ...(hint ? { "aria-describedby": `${id}-hint` } : {}),
                  // Read the value now: React clears `currentTarget` once the handler returns, before a queued update runs.
                  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { const { value } = e.currentTarget; setDraft((d) => ({ ...d, [f.text]: value })); } };
                return (
                  // The label is the original sentence: read it as a sentence, not as a small-caps field name.
                  <Field key={f.text} id={id} label={f.text} hint={hint || undefined} className="[&>label]:text-[13px] [&>label]:font-normal [&>label]:tracking-normal [&>label]:normal-case [&>label]:text-app-muted">
                    {f.text.length > LONG_TEXT ? <textarea rows={3} {...props} /> : <input {...props} />}
                  </Field>
                );
              })}
            </section>
          </details>
        );
      })}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-app px-5 py-3.5 shadow-[inset_0_1px_0_var(--color-app-line)] sm:px-7">
        {save.isError
          ? <MutationError mutation={save} />
          : <p role="status" className="text-sm text-app-muted">{unsaved ? `${unsaved} unsaved ${unsaved === 1 ? "change" : "changes"}` : save.isSuccess ? "Saved. The page now reads this way." : "No unsaved changes"}</p>}
        <div className="flex flex-wrap gap-2.5">
          {unsaved > 0 && <button type="button" className={secondaryButton} disabled={save.isPending}
            onClick={() => setDraft(Object.fromEntries(fields.map((f) => [f.text, saved(f.text)])))}>Discard changes</button>}
          <button type="submit" className={primaryButton} disabled={!unsaved || save.isPending}>Save wording</button>
        </div>
      </div>
    </form>
  );
}

const TAB_LABEL: Record<FormTab, string> = { answers: "Answers", questions: "Questions", settings: "Settings" };

/** Tabs (WAI-ARIA tabs pattern: arrow keys, Home and End move between them). */
function FormTabs({ current, onSelect }: { current: FormTab; onSelect: (tab: FormTab) => void }) {
  const refs = React.useRef<Partial<Record<FormTab, HTMLButtonElement | null>>>({});
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = FORM_TABS.indexOf(current);
    const next = { ArrowRight: FORM_TABS[(i + 1) % 3], ArrowLeft: FORM_TABS[(i + 2) % 3], Home: FORM_TABS[0], End: FORM_TABS[2] }[e.key];
    if (!next) return;
    e.preventDefault();
    onSelect(next);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label="Form" onKeyDown={onKeyDown} className="flex w-fit gap-1 rounded-full bg-app p-1 shadow-[inset_0_0_0_1px_var(--color-app-line)]">
      {FORM_TABS.map((tab) => (
        <button key={tab} ref={(el) => { refs.current[tab] = el; }} type="button" role="tab" id={`form-tab-${tab}`} aria-controls={`form-panel-${tab}`}
          aria-selected={tab === current} tabIndex={tab === current ? 0 : -1} onClick={() => onSelect(tab)}
          className={cn("min-h-10 rounded-full px-4.5 text-[15px] transition-colors duration-150", tab === current ? "bg-ink text-app" : "text-ink hover:bg-app-sunken", ring)}>
          {TAB_LABEL[tab]}
        </button>
      ))}
    </div>
  );
}

/** One of your own /f/… forms: Answers, Questions and Settings tabs. `tab` comes from the URL (`?tab=`). */
export function CustomFormPanel({ id, tab, onTab }: { id: string; tab: FormTab; onTab: (tab: FormTab) => void }) {
  const forms = useQuery(adminFormResponsesQuery);
  const form = forms.data?.find((f) => f.id === id);
  return (
    <QueryGate query={forms} what="this form">
      {form ? <FormWorkspace form={form} tab={tab} onTab={onTab} /> : <NotFound />}
    </QueryGate>
  );
}

function FormWorkspace({ form: f, tab, onTab }: { form: AdminForm; tab: FormTab; onTab: (tab: FormTab) => void }) {
  const [current, setCurrent] = React.useState(tab);
  React.useEffect(() => { setCurrent(tab); }, [tab]);
  const select = (next: FormTab) => { setCurrent(next); onTab(next); };
  const status = f.open ? "open" : "closed";
  // Every panel stays mounted (just hidden), so unsaved questions survive a look at the answers.
  const panel = (name: FormTab, children: React.ReactNode) => (
    <div role="tabpanel" id={`form-panel-${name}`} aria-labelledby={`form-tab-${name}`} hidden={current !== name} className="flex flex-col gap-6">{children}</div>
  );
  return (
    <>
      <Ticket row label="Summary" stub={(
        <div className="flex items-baseline gap-2.5 sm:flex-col sm:gap-1">
          <p className="font-geist text-[44px]/[1] text-ink tabular-nums">{f.total}</p>
          <p className="twc-eyebrow">{f.total === 1 ? "answer" : "answers"}</p>
          {f.newest_at && <p className="twc-index ml-auto sm:mt-1 sm:ml-0">newest {formatDate(f.newest_at)}</p>}
        </div>
      )}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <StatusChip status={status} />
          <p className="text-[15px] text-ink">{STATUS_LINE[status]}</p>
          <button type="button" className={linkClass} onClick={() => select("settings")}>Change in Settings</button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2"><PublicLink href={formPath(f.slug)} /><CopyLink path={formPath(f.slug)} /></div>
      </Ticket>
      <FormTabs current={current} onSelect={select} />
      {panel("answers", <AnswersCard form={f} />)}
      {panel("questions", <QuestionsSheet form={f} />)}
      {panel("settings", <SettingsCards form={f} />)}
    </>
  );
}

/** Everything saveAdminForm needs, from the form as the server last sent it, with `patch` on top. */
const formPayload = (f: AdminForm, patch: Partial<SaveAdminFormInput>): SaveAdminFormInput => ({
  id: f.id, name: f.name, slug: f.slug, intro: f.intro, thanks: f.thanks, closed_message: f.closed_message,
  open: f.open, one_per_email: f.one_per_email, questions: f.questions, ...patch,
});

const entryText = (e: AnswerEntry) => (Array.isArray(e.value) ? e.value.join(", ") : e.value).trim();

function AnswersCard({ form: f }: { form: AdminForm }) {
  const csv = useDownloadFormCsv();
  const [query, setQuery] = React.useState("");
  const rows = f.responses.filter((r) => matchesSearch(query, r.entries.map(entryText)));
  const searchId = `answers-search-${f.id}`;
  if (f.total === 0) {
    return (
      <Card id="answers" title="Answers">
        <div className={cn(pad, "flex flex-col gap-2 py-8")}>
          <p className="font-script text-[30px]/[1.1] text-app-accent">no answers yet</p>
          <p className="max-w-[60ch] text-[15px] text-ink">
            {f.open ? "Share the link above. Each answer lands here the moment it’s sent." : "This form is closed. Open it in Settings, then share the link above."}
          </p>
        </div>
      </Card>
    );
  }
  return (
    <Card id="answers" title="Answers" subtitle="Newest first. Open one to read it in full."
      action={(
        <button type="button" className={secondaryButton} disabled={csv.isPending} onClick={() => csv.mutate(f.id)}>
          <Icon name="download" className="size-4" />Download CSV
        </button>
      )}>
      {/* A handful is quicker to scan than to search. */}
      {f.responses.length > 5 && (
        <div role="search" className={cn(pad, "flex flex-col gap-1.5 py-4")}>
          <label htmlFor={searchId} className="text-sm font-medium text-ink">Search answers</label>
          <input id={searchId} type="search" value={query} autoComplete="off" onChange={(e) => setQuery(e.currentTarget.value)} className={cn(fieldClass, "max-w-120")} />
        </div>
      )}
      {f.total > f.responses.length && <p className={cn(pad, meta, "py-3")}>Showing the newest {f.responses.length}. Download CSV for all {f.total}.</p>}
      {rows.length === 0
        ? <Empty>No answers match “{query}”.</Empty>
        : (
          <ul aria-label="Answers" className="divide-y divide-app-rule">
            {rows.map((r) => {
              const title = answerTitle(r.entries);
              const rest = r.entries.map(entryText).filter((text) => text && text !== title).join(" · ");
              return (
                <li key={r.id}>
                  <details className="group">
                    <summary className={cn("flex min-h-16 cursor-pointer list-none items-center gap-3.5 px-5 py-3 transition-colors duration-150 hover:bg-app-sunken sm:px-7 [&::-webkit-details-marker]:hidden", ring)}>
                      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-app-sunken font-geist text-sm text-ink group-hover:bg-app">
                        {title === NO_NAME ? "–" : initials(title)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px] font-medium text-ink">{title}</span>
                        {rest && <span className="truncate text-[13px] text-app-muted group-open:hidden">{rest}</span>}
                      </span>
                      <span className="twc-index shrink-0 max-sm:hidden">{formatDate(r.created_at)}</span>
                      <Icon name="chevron-down" className="size-3.5 shrink-0 text-app-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                    </summary>
                    <div className="px-2 pb-4 sm:pr-4 sm:pl-18">
                      <p className="twc-index px-3.5 pb-2 sm:hidden">{formatDate(r.created_at)}</p>
                      <AnswerList entries={r.entries} />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      {csv.isError && <div className={cn(pad, "py-3")}><MutationError mutation={csv} /></div>}
    </Card>
  );
}

/** The Questions tab: the form on paper, every word edited in place (name, intro, questions, thank-you). */
function QuestionsSheet({ form: f }: { form: AdminForm }) {
  const save = useSaveAdminForm();
  // Bumped after each save (once the refetch is in), so the sheet starts again from what was stored.
  const [round, setRound] = React.useState(0);
  return (
    <QuestionsEditor key={round} idPrefix={`form-${f.id}`} busy={save.isPending} saved={round > 0}
      error={save.isError ? errorMessage(save.error) : null}
      initial={{ name: f.name, intro: f.intro, thanks: f.thanks, questions: draftFromQuestions(f.questions) }}
      onSave={(draft) => save.mutate(
        formPayload(f, { name: draft.name.trim(), intro: draft.intro, thanks: draft.thanks, questions: questionsFromDraft(draft.questions) }),
        { onSuccess: () => { save.reset(); setRound((r) => r + 1); } },
      )} />
  );
}

function SettingsCards({ form: f }: { form: AdminForm }) {
  const setOpen = useSetFormOpen();
  const save = useSaveAdminForm();
  const [slug, setSlug] = React.useState(f.slug);
  const [onePer, setOnePer] = React.useState(f.one_per_email);
  React.useEffect(() => { setSlug(f.slug); setOnePer(f.one_per_email); }, [f.slug, f.one_per_email]);
  const dirty = slug !== f.slug || onePer !== f.one_per_email;
  const id = (field: string) => `form-${f.id}-${field}`;
  return (
    <>
      <Card id="status" title="Open or closed" subtitle="When it’s closed, visitors see your closed message instead of the questions.">
        <OpenSwitch idPrefix={`form-${f.id}`} name={f.name} open={f.open} savedMessage={f.closed_message} busy={setOpen.isPending}
          hint="Shown at the form’s link while it’s closed (up to 1,000 characters). Blank uses the default."
          error={<MutationError mutation={setOpen} />} onSet={(open, message) => setOpen.mutate({ id: f.id, open, message })} />
      </Card>
      <Card id="details" title="Link" subtitle="Where the form lives, and who can answer. Its name is on the Questions tab.">
        <form aria-label="Link" className="flex flex-col divide-y divide-app-rule"
          onSubmit={(e) => { e.preventDefault(); save.mutate(formPayload(f, { slug: slug.trim(), one_per_email: onePer })); }}>
          <div className={cn(pad, "py-5")}>
            <Field id={id("slug")} label="Web address" className="max-w-120"
              hint={`Link: /f/${slug || "…"}. Lowercase letters, numbers and hyphens.${slug !== f.slug ? ` The old link, /f/${f.slug}, will keep working.` : ""}`}>
              <input id={id("slug")} required maxLength={40} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} disabled={save.isPending}
                aria-describedby={`${id("slug")}-hint`} onChange={(e) => setSlug(e.currentTarget.value)} className={fieldClass} />
            </Field>
          </div>
          <Toggle label="One answer per email" checked={onePer} disabled={save.isPending} onChange={(e) => setOnePer(e.currentTarget.checked)}
            description="A second answer from the same email address is turned away, with a note saying why." />
          <div className={cn(pad, "flex flex-wrap items-center justify-end gap-3 py-4")}>
            {save.isError ? <MutationError mutation={save} /> : save.isSuccess && !dirty && <p role="status" className="text-sm text-app-muted">Saved.</p>}
            <button type="submit" className={primaryButton} disabled={!dirty || save.isPending}>Save link</button>
          </div>
        </form>
      </Card>
    </>
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
function Field({ id, label, hint, className, children }: { id: string; label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("twc-field", className)}>
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
      <h3 className="font-geist font-medium text-xl/[1.3] text-ink">Add a neighborhood</h3>
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
        <h3 className="min-w-0 font-geist font-medium text-xl/[1.3] break-words text-ink">{hood.name}</h3>
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
                      <span className="font-geist text-[26px]/none text-ink">{when.day}</span>
                    </span>
                    <span>{when.weekday} · {when.time}</span>
                  </div>
                </td>
                <th scope="row" className={cn(cell, "min-w-52 font-normal")}>
                  <span className="block font-geist text-xl/[1.3] text-ink">{e.title}</span>
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
        <h3 id={id("heading")} className="font-geist font-medium text-xl/[1.3] text-ink">{event ? `Edit ${event.title}` : "Add a gathering"}</h3>
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
          <h3 id={headingId} className="font-geist font-medium text-xl/[1.3] break-words text-ink">Guest list · {event.title}</h3>
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
