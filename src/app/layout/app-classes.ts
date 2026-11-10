// The internal tools' controls (/account, /admin; DESIGN.md "Internal tools"): airmail pills and fields
// (`air-*` in src/app/twc.css). Class strings, so any element can wear them.
import { cn } from "@/index";

export const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent";
/** The page's one primary action, in airmail red (Save on /account). Everything else is navy or outlined. */
export const redButton = cn("air-btn air-btn--red", ring);
/** A small navy pill (Approve, Add neighborhood, Save gathering). */
export const primaryButton = cn("air-btn air-btn--navy air-btn--sm", ring);
/** A small outlined pill (Edit, Decline, Guest list, Cancel). */
export const secondaryButton = cn("air-btn air-btn--line air-btn--sm", ring);
export const fieldClass = "twc-input";
export const linkClass = cn("rounded-sm text-sm font-medium text-app-accent underline decoration-1 underline-offset-[3px] hover:text-ink", ring);
