import type * as React from "react";
import { cn } from "@/index";
import type { Profile } from "@/features/members/queries";
import type { ProfilePatch } from "@/features/members/mutations";

/** Inline `--hood` for a neighborhood color, consumed via `bg-(--hood)` / `text-(--hood)`. */
export const hoodStyle = (color?: string) => (color ? ({ "--hood": color } as React.CSSProperties) : undefined);

export const errorMessage = (error: unknown) =>
  (error as { message?: string } | null)?.message || "Something went wrong. Please try again.";

/** The draft's fields that differ from the saved profile, text trimmed: exactly what Save sends. */
export function changedFields(profile: Profile, draft: ProfilePatch): ProfilePatch {
  const changed: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(draft)) {
    const value = typeof raw === "string" ? raw.trim() : raw;
    if (value !== profile[key as keyof Profile]) changed[key] = value;
  }
  return changed as ProfilePatch;
}

/** "January 2026", or null before an admin sets it. */
export const monthYear = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "America/New_York" }) : null;

// The settings shell's controls (neutral app palette).
export const ring = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-app";
export const primaryButton = cn("inline-flex items-center justify-center rounded-[9px] bg-ink px-4 py-2.25 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40", ring);
export const secondaryButton = cn("inline-flex items-center justify-center gap-2 rounded-[9px] border border-app-line bg-app px-3.5 py-2.25 text-sm font-medium text-ink transition-colors hover:bg-app-sunken disabled:opacity-40", ring);
export const fieldClass = cn("w-full min-w-0 rounded-lg border border-app-line bg-app px-3 py-1.5 text-[15px] text-ink placeholder:text-app-muted", ring);
export const linkClass = cn("rounded-sm text-sm font-medium text-app-accent hover:underline underline-offset-4", ring);

/** The Save button's form: every profile input joins it through `form=`, so native validation runs on Save. */
export const PROFILE_FORM = "account-profile";
export const fieldId = (key: keyof Profile) => `account-${key}`;

export type CardKey = "public" | "words";

/** Page-level edit state the editable cards share. `card` is the saved profile with the draft on top. */
export interface ProfileEditor {
  card: Profile;
  set: (patch: ProfilePatch) => void;
  isEditing: (key: CardKey) => boolean;
  toggle: (key: CardKey) => void;
  /** Opens the card and focuses the field. */
  add: (key: CardKey, field: keyof Profile) => void;
}
