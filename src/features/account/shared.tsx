// Account-only building blocks in the airmail vocabulary (`air-*` in src/app/twc.css; DESIGN.md "Member profile").
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/index";
import { ring } from "@/app/layout/app-classes";
import { Icon, type IconName } from "@/app/layout/icons";

/** A letter on the desk: "Nº 01", a Fraunces title and a line under it. `id` makes it a tab anchor. */
export function AirCard({ id, no, title, subtitle, action, span, className, children }: {
  id?: string; no: number; title: string; subtitle?: React.ReactNode; action?: React.ReactNode; span?: 5 | 7;
  className?: string; children: React.ReactNode;
}) {
  const headingId = React.useId();
  return (
    <section id={id} aria-labelledby={headingId} className={cn("air-card", span && `air-span-${span}`, className)}>
      <header className="air-ch">
        <div className="min-w-0">
          <p className="air-no">Nº {String(no).padStart(2, "0")}</p>
          <h2 id={headingId}>{title}</h2>
          {subtitle && <p className="air-sub">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** "Edit" / "Done" in a card head; the accessible name carries the card ("Edit public card"). */
export function AirEdit({ card, editing, onClick }: { card: string; editing: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("air-btn air-btn--line air-btn--sm shrink-0", ring)}>
      <Icon name={editing ? "check" : "pencil"} />{editing ? "Done" : "Edit"}<span className="sr-only"> {card}</span>
    </button>
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
        {add && (
          <button type="button" onClick={add.onClick} className={cn("air-link shrink-0", ring)}>
            Add<span className="sr-only"> {add.field}</span>
          </button>
        )}
      </dd>
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

/**
 * Card body before approval: gatherings, headshots and introductions open once she is welcomed in. The /join link
 * shows only to someone who hasn't applied; an applicant (pending or declined) already has.
 */
export function Locked({ applied }: { applied: boolean }) {
  return (
    <EmptySlot icon="shield-check">
      <p className="air-empty-title">Unlocks once you’re welcomed in</p>
      <p>Members see gatherings, headshot booking, and personal introductions here.</p>
      {!applied && <Link to="/join" className={cn("air-link", ring)}>Haven’t applied yet? Start your application</Link>}
    </EmptySlot>
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
