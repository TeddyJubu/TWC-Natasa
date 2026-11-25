// The Cal pages' shared pieces. They use the `sb-*` tokens and `twc-*` classes, which `.air` re-points, so the same
// component sits right on the public scrapbook pages and the internal airmail ones.
import * as React from "react";
import { AlertDialog, AlertDialogClose, AlertDialogContent, AlertDialogTitle } from "@ui-sdk/react/alert-dialog";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@ui-sdk/react/dialog";
import { cn } from "@/index";
import { buildIcs, formatDay, formatRange, formatTime, googleCalendarUrl, zoneLabel } from "./time";
import { slugify } from "./types";

export type StatusKind = "cancelled" | "ended" | "full" | "hidden" | "scheduled" | "accepted" | "pending" | "rejected";
const STATUS: Record<StatusKind, { label: string; className: string }> = {
  cancelled: { label: "Cancelled", className: "bg-sb-ink text-sb-paper" },
  ended: { label: "Ended", className: "twc-chip--ring" },
  full: { label: "Full", className: "bg-sb-butter text-sb-ink" },
  hidden: { label: "Unlisted", className: "twc-chip--ring" },
  scheduled: { label: "Scheduled", className: "twc-chip--ring" },
  accepted: { label: "Confirmed", className: "bg-sb-ink text-sb-paper" },
  pending: { label: "Awaiting confirmation", className: "bg-sb-butter text-sb-ink" },
  rejected: { label: "Declined", className: "twc-chip--ring" },
};

export function StatusBadge({ kind, label, className }: { kind: StatusKind; label?: string; className?: string }) {
  return <span className={cn("twc-chip", STATUS[kind].className, className)}>{label ?? STATUS[kind].label}</span>;
}
export const CancelledBadge = () => <StatusBadge kind="cancelled" />;
export const EndedBadge = () => <StatusBadge kind="ended" />;

export function CategoryChip({ category, className }: { category: string; className?: string }) {
  return <span className={cn("twc-chip twc-chip--ring", className)}>{category}</span>;
}

/**
 * A time in the event's own zone. The server has no visitor locale, so it renders `en-US` and the browser re-renders
 * in the visitor's after hydration, without a mismatch.
 */
export function useVisitorLocale(): string {
  const [locale, setLocale] = React.useState("en-US");
  React.useEffect(() => {
    if (navigator.language) setLocale(navigator.language);
  }, []);
  return locale;
}

export function DateTimeText({ iso, end, timeZone, mode = "range", className }: {
  iso: string; end?: string; timeZone: string; mode?: "range" | "day" | "time"; className?: string;
}) {
  const locale = useVisitorLocale();
  const text = mode === "day"
    ? formatDay({ iso, timeZone, locale })
    : mode === "time"
      ? `${formatTime({ iso, timeZone, locale })} ${zoneLabel({ iso, timeZone, locale })}`
      : formatRange(iso, end ?? iso, timeZone, locale);
  return <time dateTime={iso} className={className}>{text}</time>;
}

export function ErrorBanner({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-wrap items-center gap-4 rounded-md bg-sb-cream px-4 py-3 text-sb-ink", className)}>
      <p className="min-w-0 flex-1">{message}</p>
      {onRetry && <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/** One short-lived message per page: `const { toast, toastNode } = useToast()`, then render `toastNode`. */
export function useToast() {
  const [message, setMessage] = React.useState("");
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toast = React.useCallback((next: string) => {
    setMessage(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 4000);
  }, []);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const toastNode = <Toast message={message} />;
  return { toast, toastNode };
}

/** Always mounted, so a screen reader announces each change. */
export function Toast({ message }: { message: string }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-5 z-50 flex justify-center">
      {message && <p className="pointer-events-auto rounded-full bg-sb-ink px-5 py-2.5 text-sm text-sb-paper shadow-lg">{message}</p>}
    </div>
  );
}

const CONFIRM_PANEL = "fixed inset-0 m-auto h-fit max-h-[calc(100dvh-32px)] overflow-y-auto w-[min(440px,calc(100vw-32px))] rounded-lg bg-sb-paper p-6 text-sb-ink shadow-xl backdrop:bg-black/50";
const CONFIRM_TITLE = "font-display text-2xl";
const CONFIRM_CANCEL = "twc-btn twc-btn--outline twc-btn--sm";

/**
 * A question before an action, as an alert dialog (focus starts on the safe answer). `form` is for one that collects
 * fields: a plain Dialog, so focus starts on the first field, and a stray press outside can't lose what was typed.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = "Keep it", busy, danger, form, onConfirm, onClose }: {
  open: boolean; title: string; children?: React.ReactNode; confirmLabel: string; cancelLabel?: string; busy?: boolean; danger?: boolean; form?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  const onOpenChange = (next: boolean) => { if (!next) onClose(); };
  const body = children && <div className="mt-3 flex flex-col gap-3 text-[15px]">{children}</div>;
  const confirm = (
    <button type="button" disabled={busy} className={cn("twc-btn twc-btn--sm", danger && "twc-btn--danger")} onClick={onConfirm}>
      {busy ? "Working…" : confirmLabel}
    </button>
  );
  if (form) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} closeOnOutsidePress={false}>
        <DialogContent className={CONFIRM_PANEL}>
          <DialogTitle className={CONFIRM_TITLE}>{title}</DialogTitle>
          {body}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <DialogClose className={CONFIRM_CANCEL}>{cancelLabel}</DialogClose>
            {confirm}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={CONFIRM_PANEL}>
        <AlertDialogTitle className={CONFIRM_TITLE}>{title}</AlertDialogTitle>
        {body}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <AlertDialogClose className={CONFIRM_CANCEL}>{cancelLabel}</AlertDialogClose>
          {confirm}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** An .ics download, built in the browser, plus a Google Calendar link. */
export function AddToCalendar({ entry, className }: { entry: Parameters<typeof buildIcs>[0]; className?: string }) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([buildIcs(entry)], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(entry.title) || "event"}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" onClick={download}>Add to calendar (.ics)</button>
      <a className="twc-btn twc-btn--outline twc-btn--sm" href={googleCalendarUrl(entry)} target="_blank" rel="noopener noreferrer">
        Google Calendar<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  );
}

/** A label, its control, a hint and an error wired together with aria-describedby and aria-invalid. */
export function FormField({ label, hint, error, required, className, children }: {
  label: string; hint?: React.ReactNode; error?: string; required?: boolean; className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: true; required?: boolean }) => React.ReactNode;
}) {
  const id = React.useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("twc-field", className)}>
      <label htmlFor={id}>{label}{required && <span aria-hidden> *</span>}</label>
      {children({ id, "aria-describedby": describedBy, ...(error ? { "aria-invalid": true as const } : {}), ...(required ? { required } : {}) })}
      {hint && <p id={hintId} className="text-sm text-sb-muted">{hint}</p>}
      {error && <p id={errorId} className="twc-error">{error}</p>}
    </div>
  );
}
