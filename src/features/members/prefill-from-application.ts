/**
 * On approval, copy a private draft of the member profile from her newest application.
 * Only blank profile fields; never directory_visible / public_profile; never phone or consents.
 * Safe to call more than once (blank-only).
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

function website(value: unknown): string {
  const raw = clip(value, TEXT.website);
  if (!raw) return "";
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
  if (!Array.isArray(industry)) return "";
  const first = industry.find((x): x is string => typeof x === "string" && x.trim() !== "");
  if (!first) return "";
  if (first === "Other") return clip(answers.otherIndustry, TEXT.specialty);
  return clip(first, TEXT.specialty);
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
    role_title: clip(answers.role, TEXT.role_title),
    business: clip(answers.business, TEXT.business),
    website: website(answers.website),
    looking_for: clip(answers.idealReferral, TEXT.looking_for),
    bio: dir.bio,
    specialty,
    neighborhood: hood && listedNeighborhoods.has(hood) ? hood : null,
  };
}

/**
 * Fills blank profile fields from the member's newest application. No-op when she has none.
 * Never flips visibility. Call inside the same transaction as an approval when one exists.
 */
export function prefillProfileFromApplication(db: DB, profileId: string): void {
  const profile = db.prepare(
    `select full_name, role_title, business, neighborhood, specialty, bio, looking_for, website,
            directory_visible, public_profile from profiles where id = ?`,
  ).get(profileId) as {
    full_name: string; role_title: string; business: string; neighborhood: string | null;
    specialty: string; bio: string; looking_for: string; website: string;
    directory_visible: number; public_profile: number;
  } | undefined;
  if (!profile) return;

  const app = db.prepare(
    `select full_name, neighborhood, answers from applications
     where user_id = ? order by created_at desc, id desc limit 1`,
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

  // Visibility is never copied from the application (private draft only).
  if (!sets.length) return;
  db.prepare(`update profiles set ${sets.join(", ")} where id = ?`).run(...values, profileId);
}
