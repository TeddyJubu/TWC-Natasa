// The internal tools' building blocks (/account, /admin; DESIGN.md "Internal tools"): airmail letters on the onionskin
// desk, mono labels, navy rules, stamps and tickets (`air-*` in src/app/twc.css, on the `air-*` tokens in theme.css).
import * as React from "react";
import { cn, initials, type MemberProfile } from "@/index";
import { Icon, type IconName } from "./icons";
import { linkClass, ring, secondaryButton } from "./app-classes";

/**
 * A letter on the desk: "Nº 01" in red mono, a Gilda Display title, a navy rule under the head (`rule`), then the body.
 * Without `no` it numbers itself in page order. `id` makes it a nav anchor; `span` is its width in /account's bento.
 */
export function Letter({ id, no, title, subtitle, action, span, rule, className, children }: {
  id?: string; no?: number; title: string; subtitle?: React.ReactNode; action?: React.ReactNode; span?: 5 | 7;
  rule?: boolean; className?: string; children: React.ReactNode;
}) {
  const headingId = React.useId();
  return (
    <section id={id} aria-labelledby={headingId} className={cn("air-card", span && `air-span-${span}`, className)}>
      <header className={cn("air-ch", rule && "mb-0 pb-5")}>
        <div className="min-w-0">
          <p className="air-no" aria-hidden={no === undefined || undefined}>{no !== undefined && `Nº ${String(no).padStart(2, "0")}`}</p>
          <h2 id={headingId}>{title}</h2>
          {subtitle && <p className="air-sub">{subtitle}</p>}
        </div>
        {action}
      </header>
      {rule && <div className="air-rule" />}
      {children}
    </section>
  );
}

/** A letter whose children (or a list's items) are rows on ruled lines: the admin cards. */
export function Card({ children, ...letter }: Omit<React.ComponentProps<typeof Letter>, "rule">) {
  return <Letter {...letter} rule><div className="air-rows">{children}</div></Letter>;
}

/** "Edit" / "Done" in a card head; the accessible name carries the card ("Edit public card"). */
export function EditButton({ card, editing, onClick }: { card: string; editing: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn(secondaryButton, "shrink-0")}>
      <Icon name={editing ? "check" : "pencil"} />{editing ? "Done" : "Edit"}<span className="sr-only"> {card}</span>
    </button>
  );
}

/** A trailing "Add" whose name includes the field. */
function AddButton({ add, className }: { add: { field: string; onClick: () => void }; className: string }) {
  return (
    <button type="button" onClick={add.onClick} className={cn(className, "shrink-0")}>
      Add<span className="sr-only"> {add.field}</span>
    </button>
  );
}

/**
 * One label/value row on a ruled line (a mono label, the value in ink): side by side from lg, stacked below. `htmlFor`
 * makes the label a real <label> (edit mode). `empty` greys the value and its icon; `add` puts a trailing "Add".
 */
export function Row({ label, htmlFor, icon, empty, add, top, children }: {
  label: string; htmlFor?: string; icon?: IconName; empty?: boolean; add?: { field: string; onClick: () => void }; top?: boolean;
  children: React.ReactNode;
}) {
  const Label = htmlFor ? "label" : "span";
  return (
    <div className={cn("flex flex-col gap-2 px-4 py-4 sm:px-5.5 lg:flex-row lg:gap-4", top ? "lg:items-start" : "lg:items-center")}>
      <Label htmlFor={htmlFor} className={cn("air-lbl mb-0 lg:w-44 lg:shrink-0", top && "lg:pt-1")}>{label}</Label>
      <div className={cn("flex min-w-0 flex-1 items-center gap-2 text-[14.5px] font-medium break-words", empty ? "text-app-muted" : "text-ink")}>
        {icon && <Icon name={icon} className={cn("size-4", empty ? "text-app-muted/70" : "text-ink-muted")} />}
        <div className="min-w-0 flex-1">{children}</div>
        {add && <AddButton add={add} className={linkClass} />}
      </div>
    </div>
  );
}

/**
 * One cell of a customs-form card: a mono label over the value. `htmlFor` makes the label a real <label> (edit
 * mode); `empty` greys the value; `add` puts a trailing "Add" whose name includes the field.
 */
export function Field({ label, htmlFor, icon, empty, add, className, children }: {
  label: string; htmlFor?: string; icon?: IconName; empty?: boolean; add?: { field: string; onClick: () => void };
  className?: string; children: React.ReactNode;
}) {
  const Label = htmlFor ? "label" : "span";
  return (
    <div className={cn("air-cell", className)}>
      <dt><Label htmlFor={htmlFor} className="air-lbl">{label}</Label></dt>
      <dd className={cn("air-val", empty && "air-val--empty")}>
        {icon && !htmlFor && <Icon name={icon} />}
        <div className="min-w-0 flex-1">{children}</div>
        {add && <AddButton add={add} className={cn("air-link", ring)} />}
      </dd>
    </div>
  );
}

/** Chip tones. Outlined is still open; filled navy is settled; red is a no. */
export type ChipTone = "pending" | "ok" | "gel" | "gel-green" | "no" | "muted";
// TODO(human): decide how a status reads at a glance across /admin. The entries below are a working default.
// Rework `pending`, `ok`, `no` and `muted` (keep the gel lines); use only air-*/app-*/ink/danger tokens.
const TONE: Record<ChipTone, string> = {
  pending: "text-ink shadow-[inset_0_0_0_1.5px_currentColor]",
  ok: "bg-air-navy text-air-paper",
  gel: "twc-gel",
  "gel-green": "twc-gel twc-gel--green",
  no: "text-danger shadow-[inset_0_0_0_1.5px_currentColor]",
  muted: "text-app-muted shadow-[inset_0_0_0_1px_var(--color-air-line)]",
};

/** A small status chip in mono capitals, like a stamp. The gel tones keep the forms' glossy pill. */
export function Chip({ tone = "muted", className, children }: { tone?: ChipTone; className?: string; children: React.ReactNode }) {
  const gel = tone === "gel" || tone === "gel-green";
  return (
    <span className={cn(
      "inline-flex min-h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 whitespace-nowrap",
      gel ? "twc-chip py-1 text-xs/[18px]" : "font-plex text-[10px]/none font-semibold tracking-[0.14em] uppercase",
      TONE[tone], className,
    )}>{children}</span>
  );
}

/** A labelled switch row: a real checkbox with role="switch"; the track is decoration. */
export function Toggle({ label, description, ...input }: { label: string; description: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex cursor-pointer items-start gap-6 px-4 py-4.5 sm:px-5.5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-base font-medium text-ink">{label}</span>
        <span className="text-[13px]/[1.5] text-app-muted">{description}</span>
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" {...input} />
      <span
        aria-hidden
        className="relative mt-0.5 h-6.5 w-11 shrink-0 rounded-full bg-ink/30 transition-colors duration-150 peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-app-accent after:absolute after:top-0.75 after:left-0.75 after:size-5 after:rounded-full after:bg-app after:transition-transform after:duration-300 after:ease-snap peer-checked:after:translate-x-4.5 motion-reduce:transition-none motion-reduce:after:transition-none"
      />
    </label>
  );
}

export function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-4 px-4 py-4 text-sm text-app-muted sm:px-5.5">
      <p>{message}</p>
      <button type="button" onClick={onRetry} className={secondaryButton}>Retry</button>
    </div>
  );
}

/** A dashed slot with a blank stamp: empty lists and locked cards. */
export function EmptySlot({ icon = "users", children }: { icon?: IconName; children: React.ReactNode }) {
  return (
    <div className="air-empty">
      <div aria-hidden className="air-empty-stamp"><span><Icon name={icon} /></span></div>
      <div className="flex min-w-0 flex-col items-start gap-1.5">{children}</div>
    </div>
  );
}

/** A ticket's stub (decorative: the body says the date in words). */
export function TicketDate({ when, tone = "navy" }: { when: { month: string; day: string; weekday: string }; tone?: "navy" | "red" | "muted" }) {
  return (
    <div aria-hidden className={cn("air-t-date", tone !== "navy" && `air-t-date--${tone}`)}>
      <small>{when.month}</small><b>{when.day}</b><small>{when.weekday}</small>
    </div>
  );
}

/** The small line under a stamp's name ("Ceramics · Sunnyside"): her craft, else her role, then where; only what is set. */
function stampCaption(m: MemberProfile): string {
  return [m.specialty || m.role, m.neighborhood].filter(Boolean).join(" · ");
}

/**
 * A member as a postage stamp (`air-slot` in a perforated `air-sheet`): number in red mono, value in cents, portrait or
 * initials on navy (never a stand-in photo), name in Geist capitals, a caption, "twc." on its side. A real button named
 * by `label`. With `pressed` it is a toggle that lifts off the sheet when on, leaving a dashed spot (/directory);
 * without, it just opens something (/account's introductions).
 */
export function Stamp({ member: m, label, pressed, onClick }: { member: MemberProfile; label: string; pressed?: boolean; onClick: () => void }) {
  const n = m.catalogueNumber;
  return (
    <button type="button" aria-pressed={pressed} aria-label={label} onClick={onClick} className={cn("air-slot", ring, pressed && "is-out")}>
      {pressed !== undefined && <span aria-hidden className="air-slot-ghost">Torn out · tap to return</span>}
      <span aria-hidden className="air-slot-stamp">
        <span className="air-slot-top">{n !== undefined && <><b>nº {String(n).padStart(2, "0")}</b><i>{n}¢</i></>}</span>
        <span className="air-slot-ph">{m.image ? <img src={m.image} alt="" loading="lazy" /> : <span>{initials(m.name)}</span>}</span>
        <span className="air-slot-foot">
          <span className="min-w-0"><strong>{m.name}</strong><small>{stampCaption(m)}</small></span>
          <em>twc.</em>
        </span>
      </span>
    </button>
  );
}
