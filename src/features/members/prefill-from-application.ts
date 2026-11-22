/**
 * On approval, copy a private draft of the member profile from her newest approved application.
 * Only blank profile fields; never directory_visible / public_profile; never phone or consents.
 * One-shot via `application_draft_at` (blank-only thereafter). Visibility flags do not skip —
 * a pending saved directory/public choice must still get the draft on approve.
 */
import type { DB } from "@/server/db";

type AppRow = {
  full_name: string;
  neighborhood: string;
  answers: string;
};

type Answers = {
  role?: unknown;
  business?: unknown;
  website?: unknown;
  idealReferral?: unknown;
  industry?: unknown;
  otherIndustry?: unknown;
  directory?: unknown;
  // Legacy import keys (scripts/fixtures/legacy-applications.json / legacy-import.ts).
  profession_role?: unknown;
  business_practice?: unknown;
  website_social?: unknown;
  industry_labels?: unknown;
};

const TEXT = {
  full_name: 120,
  role_title: 120,
  business: 120,
  specialty: 80,
  bio: 400,
  looking_for: 160,
  website: 200,
} as const;

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max).trimEnd() : trimmed;
}

/** First non-empty string among the candidates, clipped to max. */
function first(max: number, ...candidates: unknown[]): string {
  for (const value of candidates) {
    const text = clip(value, max);
    if (text) return text;
  }
  return "";
}

/**
 * Keep the URL only when the whole string fits the profile column. Truncating would save a
 * different link than the applicant sent.
 */
function website(value: unknown): string {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw || raw.length > TEXT.website) return "";
  const lower = raw.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) return raw;
  return "";
}

function directoryDraft(answers: Answers): { bio: string; specialty: string } {
  const dir = answers.directory;
  if (!dir || typeof dir !== "object" || Array.isArray(dir)) return { bio: "", specialty: "" };
  const choice = (dir as { choice?: unknown }).choice;
  if (choice !== "yes") return { bio: "", specialty: "" };
  return {
    bio: clip((dir as { bio?: unknown }).bio, TEXT.bio),
    specialty: clip((dir as { services?: unknown }).services, TEXT.specialty),
  };
}

function specialtyFallback(answers: Answers): string {
  const industry = answers.industry;
  if (Array.isArray(industry)) {
    const firstLabel = industry.find((x): x is string => typeof x === "string" && x.trim() !== "");
    if (firstLabel === "Other") return clip(answers.otherIndustry, TEXT.specialty);
    if (firstLabel) return clip(firstLabel, TEXT.specialty);
  }
  return clip(answers.industry_labels, TEXT.specialty);
}

/** Maps application answers → profile patch for blank fields only. Exported for unit tests. */
export function draftFromApplication(
  app: { full_name: string; neighborhood: string; answers: unknown },
  listedNeighborhoods: ReadonlySet<string>,
): Partial<Record<keyof typeof TEXT | "neighborhood", string | null>> {
  const answers = (app.answers && typeof app.answers === "object" && !Array.isArray(app.answers)
    ? app.answers
    : {}) as Answers;
  const dir = directoryDraft(answers);
  const specialty = dir.specialty || specialtyFallback(answers);
  const hood = app.neighborhood.trim();
  return {
    full_name: clip(app.full_name, TEXT.full_name),
    role_title: first(TEXT.role_title, answers.role, answers.profession_role),
    business: first(TEXT.business, answers.business, answers.business_practice),
    website: website(answers.website) || website(answers.website_social),
    looking_for: clip(answers.idealReferral, TEXT.looking_for),
    bio: dir.bio,
    specialty,
    neighborhood: hood && listedNeighborhoods.has(hood) ? hood : null,
  };
}

/**
 * Fills blank profile fields from the member's newest approved application. No-op when she has
 * none, or when `application_draft_at` is already set (one-shot: never restore a cleared field).
 * Visibility flags are ignored — a pending member may save directory/public choices before
 * approval, and those must not skip the draft. Never flips visibility. Call inside the same
 * transaction as an approval when one exists.
 */
export function prefillProfileFromApplication(db: DB, profileId: string): void {
  const profile = db.prepare(
    `select full_name, role_title, business, neighborhood, specialty, bio, looking_for, website,
            application_draft_at from profiles where id = ?`,
  ).get(profileId) as {
    full_name: string; role_title: string; business: string; neighborhood: string | null;
    specialty: string; bio: string; looking_for: string; website: string;
    application_draft_at: string | null;
  } | undefined;
  if (!profile) return;
  // Already applied once: never restore a field she cleared and saved.
  if (profile.application_draft_at) return;

  const app = db.prepare(
    `select full_name, neighborhood, answers from applications
     where user_id = ? and status = 'approved' order by created_at desc, id desc limit 1`,
  ).get(profileId) as AppRow | undefined;
  if (!app) return;

  let answers: unknown = {};
  try {
    answers = JSON.parse(app.answers) as unknown;
  } catch {
    answers = {};
  }

  const listed = new Set(
    (db.prepare("select name from neighborhoods").all() as { name: string }[]).map((r) => r.name),
  );
  const draft = draftFromApplication({ full_name: app.full_name, neighborhood: app.neighborhood, answers }, listed);

  const blank = (current: string | null | undefined) => !current || !String(current).trim();
  const sets: string[] = [];
  const values: (string | null)[] = [];

  const take = (column: keyof typeof TEXT, value: string) => {
    if (!value || !blank(profile[column])) return;
    sets.push(`${column} = ?`);
    values.push(value);
  };

  take("full_name", draft.full_name ?? "");
  take("role_title", draft.role_title ?? "");
  take("business", draft.business ?? "");
  take("website", draft.website ?? "");
  take("looking_for", draft.looking_for ?? "");
  take("bio", draft.bio ?? "");
  take("specialty", draft.specialty ?? "");

  if (draft.neighborhood && blank(profile.neighborhood)) {
    sets.push("neighborhood = ?");
    values.push(draft.neighborhood);
  }

  // Stamp even when every field was already filled, so we never re-run on the next read.
  const now = new Date().toISOString();
  sets.push("application_draft_at = ?");
  values.push(now);
  db.prepare(`update profiles set ${sets.join(", ")} where id = ?`).run(...values, profileId);
}
