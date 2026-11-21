// The Cal pages' shared pieces. They use the `sb-*` tokens and `twc-*` classes, which `.air` re-points, so the same
// component sits right on the public scrapbook pages and the internal airmail ones.
import * as React from "react";
import { cn } from "@/index";
import { formatDay, formatRange, formatTime, zoneLabel } from "./time";

export type StatusKind = "cancelled" | "ended" | "full" | "hidden" | "scheduled" | "accepted" | "pending" | "rejected";
const STATUS: Record<StatusKind, { label: string; className: string }> = {
  cancelled: { label: "Cancelled", className: "bg-sb-ink text-sb-paper" },
  ended: { label: "Ended", className: "twc-chip--ring" },
  full: { label: "Full", className: "bg-sb-sun text-sb-ink" },
  hidden: { label: "Unlisted", className: "twc-chip--ring" },
  scheduled: { label: "Scheduled", className: "twc-chip--ring" },
  accepted: { label: "Confirmed", className: "bg-sb-ink text-sb-paper" },
  pending: { label: "Awaiting confirmation", className: "bg-sb-sun text-sb-ink" },
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

/** A native modal: the browser traps focus, closes on Escape and hands focus back. */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = "Keep it", busy, danger, onConfirm, onClose }: {
  open: boolean; title: string; children?: React.ReactNode; confirmLabel: string; cancelLabel?: string; busy?: boolean; danger?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);
  return (
    <dialog
      ref={ref} aria-labelledby={titleId} onClose={onClose}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-lg bg-sb-paper p-6 text-sb-ink shadow-xl backdrop:bg-black/50"
    >
      <h2 id={titleId} className="font-display text-2xl">{title}</h2>
      {children && <div className="mt-3 flex flex-col gap-3 text-[15px]">{children}</div>}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" onClick={onClose}>{cancelLabel}</button>
        <button type="button" disabled={busy} className={cn("twc-btn twc-btn--sm", danger && "twc-btn--danger")} onClick={onConfirm}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
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
