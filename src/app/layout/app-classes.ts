// The app shell's controls (internal pages, neutral app palette). Class strings, so any element can wear them.
import { cn } from "@/index";

export const ring = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-app";
export const primaryButton = cn("inline-flex items-center justify-center rounded-[9px] bg-ink px-4 py-2.25 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40", ring);
export const secondaryButton = cn("inline-flex items-center justify-center gap-2 rounded-[9px] border border-app-line bg-app px-3.5 py-2.25 text-sm font-medium text-ink transition-colors hover:bg-app-sunken disabled:opacity-40", ring);
export const fieldClass = cn("w-full min-w-0 rounded-lg border border-app-line bg-app px-3 py-1.5 text-[15px] text-ink placeholder:text-app-muted", ring);
export const linkClass = cn("rounded-sm text-sm font-medium text-app-accent hover:underline underline-offset-4", ring);
