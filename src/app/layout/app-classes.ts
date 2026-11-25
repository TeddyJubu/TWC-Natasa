// The signed-in pages' controls (/account, /directory, /feed, /admin; DESIGN.md "Internal tools"): the canvas pills and
// fields (`air-*` in src/app/twc-app.css). Class strings, so any element can wear them.
import { cn } from "@/index";

export const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent";
/** The page's one primary action, a full-size ink pill (Save on /account, Post on /feed). */
export const mainButton = cn("air-btn air-btn--navy", ring);
/** A destructive action that can't be undone, in wine (Delete my account for good, a confirm's Delete). */
export const dangerButton = cn("air-btn air-btn--wine", ring);
/** A small ink pill (Approve, Add neighborhood, Save gathering). */
export const primaryButton = cn("air-btn air-btn--navy air-btn--sm", ring);
/** A small outlined pill (Edit, Decline, Guest list, Cancel). */
export const secondaryButton = cn("air-btn air-btn--line air-btn--sm", ring);
export const fieldClass = "twc-input";
export const linkClass = cn("rounded-sm text-sm font-medium text-app-accent underline decoration-1 underline-offset-4 hover:decoration-2", ring);
