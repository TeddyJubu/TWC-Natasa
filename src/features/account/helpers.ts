import type * as React from "react";
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
