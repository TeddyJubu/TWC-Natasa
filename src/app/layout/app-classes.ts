// The app shell's controls (internal pages): the scrapbook kit's pill buttons and fields (src/app/twc.css) on the app
// palette. Class strings, so any element can wear them.
import { cn } from "@/index";

export const ring = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent";
/** A small black pill (Approve, Save changes, Request my session). */
export const primaryButton = "twc-btn twc-btn--sm";
/** A small outlined pill (Edit, Decline, Guest list, Cancel). */
export const secondaryButton = "twc-btn twc-btn--outline twc-btn--sm";
export const fieldClass = "twc-input";
export const linkClass = cn("rounded-sm text-sm font-medium text-app-accent underline decoration-1 underline-offset-[3px] hover:text-ink", ring);
