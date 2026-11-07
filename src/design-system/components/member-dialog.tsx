import * as React from "react";
import type { MemberProfile } from "./member-card";

export interface MemberDialogProps {
  /** The member to show; `null` keeps the dialog closed. */
  member: MemberProfile | null;
  /** Called on the close button, Escape, or a backdrop click; the caller clears `member`. */
  onClose: () => void;
}

/** Only absolute http(s) URLs become links; anything else (e.g. `javascript:`) stays plain text. */
function safeHref(url: string): string | undefined {
  const trimmed = url.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : undefined;
}

/**
 * Use MemberDialog to open a catalogue card into the member's full profile.
 * A native modal `<dialog>` (`showModal()`), so the page behind it is inert and Escape closes it;
 * focus returns to whatever had it when the dialog opened (the card trigger), if it is still on the page.
 * @example
 * const [open, setOpen] = React.useState<MemberProfile | null>(null);
 * <MemberCard member={m} variant="catalogue" onOpen={() => setOpen(m)} />
 * <MemberDialog member={open} onClose={() => setOpen(null)} />
 */
export function MemberDialog({ member, onClose }: MemberDialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const returnFocus = React.useRef<HTMLElement | null>(null);
  // Whether the current press began on the backdrop; see onBackdropClick.
  const pressOnBackdrop = React.useRef(false);
  const open = member !== null;

  // A layout effect, so the dialog is closed before the browser paints the render that emptied it.
  React.useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.showModal();
      }
      return;
    }
    if (dialog.open) dialog.close();
    // The trigger may have left the page while the dialog was open (e.g. the list refetched).
    if (returnFocus.current?.isConnected) returnFocus.current.focus();
    returnFocus.current = null;
  }, [open]);

  // Escape: keep the dialog open until the caller clears `member`, so React state stays the source of truth.
  const onCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onClose();
  };
  // A close the caller didn't ask for (e.g. the browser closed it) still has to reach React state.
  const onNativeClose = () => {
    if (open) onClose();
  };
  // The dialog box itself has no padding, so a pointer event whose target is the dialog is on the backdrop.
  // Both ends of the press must be there: a text selection dragged out and released on the backdrop
  // fires its click on the dialog too, and must not close it.
  const onPointerDown = (event: React.PointerEvent<HTMLDialogElement>) => {
    pressOnBackdrop.current = event.target === event.currentTarget;
  };
  const onBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    const startedOnBackdrop = pressOnBackdrop.current;
    pressOnBackdrop.current = false;
    if (startedOnBackdrop && event.target === event.currentTarget) onClose();
  };

  const roleLine = member ? [member.role, member.business].filter(Boolean).join(" · ") : "";
  const bio = member?.bio.trim();
  const lookingFor = member?.lookingFor.trim();
  const website = member?.website?.trim();
  const href = website ? safeHref(website) : undefined;

  return (
    <dialog
      ref={ref}
      aria-label={member ? `${member.name}, member profile` : undefined}
      onCancel={onCancel}
      onClose={onNativeClose}
      onPointerDown={onPointerDown}
      onClick={onBackdropClick}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto overscroll-contain rounded-panel border border-line bg-canvas p-0 text-ink shadow-soft backdrop:bg-black/70"
    >
      {member && (
        <div className="motion-panel-in flex flex-col gap-8 p-6 motion-reduce:animate-none sm:p-10">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h2 className="text-balance font-display text-4xl font-normal leading-tight sm:text-5xl">{member.name}</h2>
              {roleLine && <p className="mt-3 text-sm text-ink-muted sm:text-base">{roleLine}</p>}
              {member.neighborhood && (
                <p className="mt-2 text-xs font-medium uppercase text-ink-muted">{member.neighborhood}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-11 shrink-0 place-items-center rounded-full border border-line text-ink transition-colors duration-fast ease-gentle hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {bio && <p className="text-base leading-relaxed text-ink-muted">{bio}</p>}

          {lookingFor && (
            <div className="border-t border-line pt-5">
              <p className="text-xs font-medium uppercase text-ink-muted">Looking to meet</p>
              <p className="mt-2 font-display text-xl leading-snug sm:text-2xl">{lookingFor}</p>
            </div>
          )}

          {website && (
            <div className="border-t border-line pt-5">
              <p className="text-xs font-medium uppercase text-ink-muted">Website</p>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block break-all text-base text-ink underline underline-offset-4 hover:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  {href.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <p className="mt-2 break-all text-base text-ink">{website}</p>
              )}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
