// The app shell's building blocks (internal pages): neutral app palette, sans type. See DESIGN.md "Internal pages".
import * as React from "react";
import { cn } from "@/index";
import { Icon, type IconName } from "./icons";
import { linkClass, ring, secondaryButton } from "./app-classes";

/** A titled card; its heading names the region. `id` makes it a sidebar anchor. */
export function Card({ id, title, subtitle, action, children }: {
  id?: string; title: string; subtitle?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  const headingId = React.useId();
  return (
    <section id={id} aria-labelledby={headingId} className="w-full scroll-mt-24 overflow-hidden rounded-[14px] border border-app-line bg-app">
      <div className="flex items-center justify-between gap-4 border-b border-app-line bg-app-sunken px-5.5 py-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={headingId} className="text-base font-medium text-ink">{title}</h2>
          {subtitle && <p className="text-[13px] text-app-muted">{subtitle}</p>}
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
    <button type="button" onClick={onClick} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-app-line bg-app px-2.5 py-1.5 text-[13px] font-medium text-ink-muted hover:bg-app-sunken", ring)}>
      {!editing && <Icon name="pencil" className="size-3.25" />}
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
    <div className={cn("flex flex-col gap-1.5 px-5.5 py-3.75 lg:flex-row lg:gap-0", top ? "lg:items-start" : "lg:items-center")}>
      <Label htmlFor={htmlFor} className="text-[15px] text-app-muted lg:w-75 lg:shrink-0">{label}:</Label>
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

/** A small label: `accent` to highlight (verified, pending, active), `muted` for settled or switched-off states. */
export function Chip({ tone = "accent", children }: { tone?: "accent" | "muted"; children: React.ReactNode }) {
  return (
    <span className={cn(
      "shrink-0 rounded-md px-2 py-0.75 text-xs font-medium",
      tone === "accent" ? "bg-app-accent/10 text-app-accent" : "border border-app-line bg-app-sunken text-app-muted",
    )}>
      {children}
    </span>
  );
}

/** A labelled switch row: a real checkbox with role="switch"; the track is decoration. */
export function Toggle({ label, description, ...input }: { label: string; description: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex cursor-pointer items-center gap-6 px-5.5 py-4 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <span className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="text-[15px] font-medium text-ink">{label}</span>
        <span className="text-[13.5px]/5 text-app-muted">{description}</span>
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" {...input} />
      <span
        aria-hidden
        className="relative h-5.5 w-10 shrink-0 rounded-full bg-app-line transition-colors duration-fast peer-checked:bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-app after:absolute after:left-0.5 after:top-0.5 after:size-4.5 after:rounded-full after:bg-app after:shadow-[0_1px_2px_rgb(0_0_0/0.12)] after:transition-transform after:duration-fast peer-checked:after:translate-x-4.5 motion-reduce:transition-none motion-reduce:after:transition-none"
      />
    </label>
  );
}

export function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-4 px-5.5 py-4 text-sm text-app-muted">
      <p>{message}</p>
      <button type="button" onClick={onRetry} className={secondaryButton}>Retry</button>
    </div>
  );
}
