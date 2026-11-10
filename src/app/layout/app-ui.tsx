// The app shell's building blocks (internal pages): paper cards on cream, Gilda titles, eyebrow labels, the
// scrapbook kit's pills and chips. See DESIGN.md "Internal pages".
import * as React from "react";
import { cn } from "@/index";
import { Icon, type IconName } from "./icons";
import { linkClass, secondaryButton } from "./app-classes";

/** A paper card's frame: 6px corners, a hairline ring. */
export const cardFrame = "w-full scroll-mt-28 overflow-hidden rounded-md bg-app shadow-[inset_0_0_0_1px_var(--color-app-line)]";
/** Card-level padding, matching the head and rows. */
export const cardPad = "px-5 py-5 sm:px-7 sm:py-6";

/** A titled card; its heading names the region. `id` makes it a sidebar anchor. */
export function Card({ id, title, subtitle, action, children }: {
  id?: string; title: string; subtitle?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  const headingId = React.useId();
  return (
    <section id={id} aria-labelledby={headingId} className={cardFrame}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-app-line px-5 pt-6 pb-5 sm:px-7">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={headingId} className="font-display text-[26px]/[1.2] text-ink">{title}</h2>
          {subtitle && <p className="text-sm text-app-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="divide-y divide-app-rule">{children}</div>
    </section>
  );
}

/** "Edit" / "Done" in a card head; the accessible name carries the card ("Edit public card"). */
export function EditButton({ card, editing, onClick }: { card: string; editing: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn(secondaryButton, "shrink-0")}>
      {editing ? "Done" : "Edit"}<span className="sr-only"> {card}</span>
    </button>
  );
}

/**
 * One label/value row: side by side from lg, stacked below. `htmlFor` makes the label a real <label> (edit mode).
 * `empty` greys the value and its icon; `add` puts a trailing "Add" whose name includes the field.
 */
export function Row({ label, htmlFor, icon, empty, add, top, children }: {
  label: string; htmlFor?: string; icon?: IconName; empty?: boolean; add?: { field: string; onClick: () => void }; top?: boolean;
  children: React.ReactNode;
}) {
  const Label = htmlFor ? "label" : "span";
  return (
    <div className={cn("flex flex-col gap-2 px-5 py-4 sm:px-7 lg:flex-row lg:gap-4", top ? "lg:items-start" : "lg:items-center")}>
      <Label htmlFor={htmlFor} className={cn("twc-eyebrow lg:w-52 lg:shrink-0", top && "lg:pt-1")}>{label}</Label>
      <div className={cn("flex min-w-0 flex-1 items-center gap-2 text-[15px] break-words", empty ? "text-app-muted" : "text-ink")}>
        {icon && <Icon name={icon} className={cn("size-4", empty ? "text-app-muted/70" : "text-ink-muted")} />}
        <div className="min-w-0 flex-1">{children}</div>
        {add && (
          <button type="button" onClick={add.onClick} className={cn(linkClass, "shrink-0")}>
            Add<span className="sr-only"> {add.field}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/** Chip tones: waiting on someone (sun), settled yes (mint), settled no (danger on cream), neutral (ring only). */
export type ChipTone = "pending" | "ok" | "gel" | "no" | "muted";
const TONE: Record<ChipTone, string> = {
  pending: "bg-app-pending text-ink",
  ok: "bg-app-ok text-ink",
  gel: "twc-gel",
  no: "bg-app-sunken text-danger",
  muted: "text-app-muted",
};

/** A small ring chip (the kit's `twc-chip--ring`) in a status tone. */
export function Chip({ tone = "muted", className, children }: { tone?: ChipTone; className?: string; children: React.ReactNode }) {
  return <span className={cn("twc-chip twc-chip--ring shrink-0 px-3 py-1 text-xs/[18px] whitespace-nowrap", TONE[tone], className)}>{children}</span>;
}

/** A labelled switch row: a real checkbox with role="switch"; the track is decoration. */
export function Toggle({ label, description, ...input }: { label: string; description: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex cursor-pointer items-start gap-6 px-5 py-5 sm:px-7 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
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
    <div role="alert" className="flex flex-wrap items-center gap-4 px-5 py-4 text-sm text-app-muted sm:px-7">
      <p>{message}</p>
      <button type="button" onClick={onRetry} className={secondaryButton}>Retry</button>
    </div>
  );
}
