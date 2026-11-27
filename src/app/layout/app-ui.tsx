// The signed-in pages' building blocks (/account, /directory, /feed, /admin; DESIGN.md "Internal tools"): the canvas's
// working views — sections under a hairline ink rule, mono labels, outline pills, people with a portrait square
// (`air-*` in src/app/twc-app.css, on the `air-*` tokens in theme.css).
import * as React from "react";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import { cn, initials, type MemberProfile } from "@/index";
import { Icon, type IconName } from "./icons";
import { linkClass, ring, secondaryButton } from "./app-classes";

/**
 * A section under a hairline ink rule: "01" in muted mono, an Archivo heavy condensed title, a second rule under the head (`rule`), then the body.
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
          <p className="air-no" aria-hidden={no === undefined || undefined}>{no !== undefined && String(no).padStart(2, "0")}</p>
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

/** A section whose children (or a list's items) are rows on hairlines: the admin cards. */
export function Card({ children, ...letter }: Omit<React.ComponentProps<typeof Letter>, "rule">) {
  return <Letter {...letter} rule><div className="air-rows">{children}</div></Letter>;
}

/**
 * "Edit" / "Done editing" in a card head; the accessible name carries the card ("Edit directory card"). "Done editing"
 * only closes the fields — the page's save bar saves — so it never reads like Save.
 */
export function EditButton({ card, editing, onClick }: { card: string; editing: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn(secondaryButton, "shrink-0")}>
      <Icon name={editing ? "check" : "pencil"} />{editing ? "Done editing" : "Edit"}<span className="sr-only"> {card}</span>
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
 * One cell of a label/value grid (the directory card):a mono label over the value. `htmlFor` makes the label a real <label> (edit
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

/**
 * Chip tones, as the canvas's badges (.dbadge): waiting on someone is butter, settled is ink, a no is wine, anything
 * else is a plain outline. Every fill keeps ink text (wine and ink carry white).
 */
export type ChipTone = "pending" | "ok" | "gel" | "gel-green" | "no" | "muted";
const TONE: Record<ChipTone, string> = {
  pending: "bg-app-pending text-ink shadow-[inset_0_0_0_1px_var(--color-ink)]",
  ok: "bg-air-navy text-air-paper",
  gel: "twc-gel",
  "gel-green": "twc-gel twc-gel--green",
  no: "bg-air-red text-white",
  muted: "bg-air-paper text-ink shadow-[inset_0_0_0_1px_var(--color-ink)]",
};

/** A small status badge in tracked capitals. The gel tones are a form's open/always-on pill. */
export function Chip({ tone = "muted", className, children }: { tone?: ChipTone; className?: string; children: React.ReactNode }) {
  const gel = tone === "gel" || tone === "gel-green";
  return (
    <span className={cn(
      "inline-flex min-h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 whitespace-nowrap",
      gel ? "twc-chip py-1 text-xs/[18px]" : "text-[10.5px]/none font-medium tracking-[0.08em] uppercase",
      TONE[tone], className,
    )}>{children}</span>
  );
}

/** A labelled switch row: a ui-sdk Switch, named by the whole label. */
export function Toggle({ label, description, ...control }: { label: string; description: string } & Omit<React.ComponentProps<typeof Switch>, "children" | "className">) {
  return (
    <label className="flex cursor-pointer items-start gap-6 px-4 py-4.5 sm:px-5.5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-base font-medium text-ink">{label}</span>
        <span className="text-[13px]/[1.5] text-app-muted">{description}</span>
      </span>
      <Switch {...control} className="relative mt-0.5 h-6.5 w-11 shrink-0 cursor-[inherit] rounded-full bg-ink/30 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-app-accent data-checked:bg-ink motion-reduce:transition-none">
        <SwitchThumb className="absolute top-0.75 left-0.75 size-5 rounded-full bg-app transition-transform duration-300 ease-snap data-checked:translate-x-4.5 motion-reduce:transition-none" />
      </Switch>
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

/** A dashed box with an icon: empty lists and locked cards (the canvas's dashed lock). */
export function EmptySlot({ icon = "users", children }: { icon?: IconName; children: React.ReactNode }) {
  return (
    <div className="air-empty">
      <div aria-hidden className="air-empty-stamp"><span><Icon name={icon} /></span></div>
      <div className="flex min-w-0 flex-col items-start gap-1.5">{children}</div>
    </div>
  );
}

/** A dated row's date block (decorative: the body says the date in words). `red` marks a confirmed date (lime). */
export function TicketDate({ when, tone = "navy" }: { when: { month: string; day: string; weekday: string }; tone?: "navy" | "red" | "muted" }) {
  return (
    <div aria-hidden className={cn("air-t-date", tone !== "navy" && `air-t-date--${tone}`)}>
      <small>{when.month}</small><b>{when.day}</b><small>{when.weekday}</small>
    </div>
  );
}

/** The small line under a person's name ("Ceramics · Sunnyside"): her craft, else her role, then where; only what is set. */
function stampCaption(m: MemberProfile): string {
  return [m.specialty || m.role, m.neighborhood].filter(Boolean).join(" · ");
}

/**
 * A member as the canvas's directory card (`air-slot`): a 4:5 portrait or her initials on lime (never a stand-in photo)
 * with her number on a badge, then her name and a caption. A real button named by `label`. With `pressed` it is a
 * toggle, framed in ink while she is the one shown beside the list (/directory); without, it just opens something
 * (/account's introductions, the feed's neighbors).
 */
export function Stamp({ member: m, label, pressed, onClick }: { member: MemberProfile; label: string; pressed?: boolean; onClick: () => void }) {
  const n = m.catalogueNumber;
  return (
    <button type="button" aria-pressed={pressed} aria-label={label} onClick={onClick} className={cn("air-slot", ring, pressed && "is-out")}>
      <span aria-hidden className="air-slot-ph">
        {m.image ? <img src={m.image} alt="" loading="lazy" /> : <span>{initials(m.name)}</span>}
        {n !== undefined && <span className="air-slot-top"><b>nº {String(n).padStart(2, "0")}</b></span>}
      </span>
      <span aria-hidden className="air-slot-foot"><strong>{m.name}</strong><small>{stampCaption(m)}</small></span>
    </button>
  );
}
