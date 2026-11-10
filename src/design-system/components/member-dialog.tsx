import * as React from "react";
import type { MemberCardTone, MemberProfile } from "./member-card";
import { PolaroidMeta, Portrait } from "./member-parts";
import { cn, safeHref } from "../lib/utils";

export interface MemberDialogProps {
  /** The member to show; `null` keeps the dialog closed. */
  member: MemberProfile | null;
  /** Called on the close button, Escape, or a backdrop click; the caller clears `member`. */
  onClose: () => void;
  /** "panel" (default): the text-only profile. "polaroid": the public site's look, portrait in a tilted snapshot. */
  variant?: "panel" | "polaroid";
  /** Neighborhood colour for the polaroid's dot and initials mat (as on `MemberCard`). */
  tone?: MemberCardTone;
  /** Extra actions after the website link, e.g. a router link to the member's own page. */
  children?: React.ReactNode;
}

/** The outline pill the polaroid dialog's actions share; exported so callers' links in `children` can match. */
export const memberDialogActionClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-[22px] py-3 font-display text-[13px] uppercase leading-5 tracking-[1.6px] text-ink no-underline shadow-[inset_0_0_0_1.5px_currentColor] transition-[translate] duration-base ease-gentle hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-sky-strong motion-reduce:transition-none";

/**
 * Use MemberDialog to open a catalogue card into the member's full profile.
 * A native modal `<dialog>` (`showModal()`), so the page behind it is inert and Escape closes it;
 * focus returns to whatever had it when the dialog opened (the card trigger), if it is still on the page.
 * @example
 * const [open, setOpen] = React.useState<MemberProfile | null>(null);
 * <MemberCard member={m} variant="catalogue" onOpen={() => setOpen(m)} />
 * <MemberDialog member={open} onClose={() => setOpen(null)} />
 */
export function MemberDialog({ member, onClose, variant = "panel", tone, children }: MemberDialogProps) {
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
  const closeButton = (
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
  );
  const polaroid = variant === "polaroid";

  return (
    <dialog
      ref={ref}
      aria-label={member ? `${member.name}, member profile` : undefined}
      onCancel={onCancel}
      onClose={onNativeClose}
      onPointerDown={onPointerDown}
      onClick={onBackdropClick}
      className={cn(
        "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto overscroll-contain bg-canvas p-0 text-ink backdrop:bg-black/70",
        polaroid ? "max-w-[880px] rounded-[6px] shadow-[0_10px_28px_rgb(31_31_28/0.2)]" : "max-w-2xl rounded-panel border border-line shadow-soft",
      )}
      style={polaroid && tone ? ({ "--hood": tone.color } as React.CSSProperties) : undefined}
    >
      {member && polaroid && (
        <div className="motion-panel-in flex flex-wrap gap-8 p-5 motion-reduce:animate-none sm:p-7">
          <figure className="m-0 flex w-60 max-w-full shrink-0 -rotate-3 flex-col gap-1.5 self-start bg-canvas p-3 pb-4 shadow-[0_10px_28px_rgb(31_31_28/0.2)] max-sm:mx-auto">
            <div className="relative aspect-[4/5] overflow-hidden bg-paper">
              <Portrait member={member} imgClassName="size-full object-cover" initialsClassName={cn("text-6xl text-ink", tone ? "bg-(--hood)" : "bg-paper")} />
            </div>
            <figcaption className="font-(family-name:--font-script) text-[26px] leading-[1.4] text-sky-strong">
              {[member.name.split(/\s+/)[0], member.neighborhood].filter(Boolean).join(", ")}
            </figcaption>
          </figure>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3.5">
            <div className="flex items-center justify-between gap-3">
              <PolaroidMeta member={member} catalogueNumber={member.catalogueNumber} toned={!!tone} />
              <span className="ml-auto">{closeButton}</span>
            </div>
            <h2 className="text-balance font-display text-4xl font-normal leading-[1.09] sm:text-[40px]">{member.name}</h2>
            {(roleLine || member.specialty) && (
              <p className="text-[15px] text-ink-muted">{[roleLine, member.specialty].filter(Boolean).join(" · ")}</p>
            )}
            {bio && <p className="text-[17px] leading-relaxed">{bio}</p>}
            {lookingFor && (
              <p className="text-[15px]">
                <span className="block text-xs font-medium uppercase tracking-[2px]">Looking to meet</span>
                {lookingFor}
              </p>
            )}
            {(href || children) && (
              <div className="mt-1 flex flex-wrap gap-2">
                {href && (
                  <a href={href} target="_blank" rel="noopener noreferrer" className={memberDialogActionClass}>
                    Website <span aria-hidden>↗</span><span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
                {children}
              </div>
            )}
            {website && !href && <p className="break-all text-[15px] text-ink-muted">{website}</p>}
          </div>
        </div>
      )}
      {member && !polaroid && (
        <div className="motion-panel-in flex flex-col gap-8 p-6 motion-reduce:animate-none sm:p-10">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h2 className="text-balance font-display text-4xl font-normal leading-tight sm:text-5xl">{member.name}</h2>
              {roleLine && <p className="mt-3 text-sm text-ink-muted sm:text-base">{roleLine}</p>}
              {member.neighborhood && (
                <p className="mt-2 text-xs font-medium uppercase text-ink-muted">{member.neighborhood}</p>
              )}
            </div>
            {closeButton}
          </div>

          {member.logo && (
            <img src={member.logo} alt={`${member.business || member.name} logo`} className="h-16 w-auto max-w-[12rem] self-start object-contain" />
          )}

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
          {children && <div className="flex flex-wrap gap-2 border-t border-line pt-5">{children}</div>}
        </div>
      )}
    </dialog>
  );
}
