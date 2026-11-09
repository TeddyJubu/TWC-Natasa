// Pure helpers for /admin: ordering, readable answers, client-side joins and the checks that mirror the
// database constraints, so admins get a clear message before any network call.
import type { ApplicationAnswers } from "@/features/applications/schema";

type Status = "pending" | "approved" | "declined";

/** Pending first, then newest first. */
export function sortApplications<T extends { status: Status; created_at: string }>(apps: T[]): T[] {
  return [...apps].sort(
    (a, b) => Number(b.status === "pending") - Number(a.status === "pending") || b.created_at.localeCompare(a.created_at),
  );
}

// Labels that a plain split would get wrong, plus the CRM's own words for imported answers (CRM-032); any other key
// (including ones the form adds later) is humanised.
// ponytail: only the four CRM labels the inventory names; add the rest of its ~30 when crm/server/ingest.ts is to hand.
const LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  full_name: "Name",
  base_area: "Based in",
  goal_labels: "Hoping to find",
  coffee_chat: "Open to coffee chats",
};

export function humanizeKey(key: string): string {
  const known = LABELS[key];
  if (known) return known;
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export type AnswerEntry = { key: string; label: string; value: string | string[] };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const scalar = (v: unknown): string | undefined => {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.trim() || undefined;
  return undefined;
};

/** CRM-032: never shown — `_…`, `…_codes`, anything with token or signature, and ip. */
const hiddenKey = (k: string) => k.startsWith("_") || k.endsWith("_codes") || /token|signature/i.test(k) || k === "ip";

/**
 * Flattens the stored `answers` JSON into labelled rows: nested objects become "Parent · Child",
 * arrays stay lists, booleans read Yes/No, and empty values and hidden keys are skipped. Unknown keys are kept.
 * The import's top-level `legacy` record is bookkeeping, not an answer (its origin shows via applicationOrigin).
 */
export function formatAnswers(answers: Partial<ApplicationAnswers> | unknown): AnswerEntry[] {
  if (!isRecord(answers)) return [];
  const out: AnswerEntry[] = [];
  const walk = (obj: Record<string, unknown>, keyPath: string[], labels: string[]) => {
    for (const [k, v] of Object.entries(obj)) {
      if (hiddenKey(k) || (keyPath.length === 0 && k === "legacy")) continue;
      const key = [...keyPath, k];
      const label = [...labels, humanizeKey(k)];
      if (isRecord(v)) walk(v, key, label);
      else if (Array.isArray(v)) {
        const items = v.map(scalar).filter((s): s is string => !!s);
        if (items.length) out.push({ key: key.join("."), label: label.join(" · "), value: items });
      } else {
        const value = scalar(v);
        if (value) out.push({ key: key.join("."), label: label.join(" · "), value });
      }
    }
  };
  walk(answers, [], []);
  return out;
}

/** CRM-031's origin label: what the import recorded (Old HeyForm, Imported list, Earlier form…), else this site's form. */
export function applicationOrigin(answers: unknown): string {
  const legacy = isRecord(answers) ? answers.legacy : undefined;
  return (isRecord(legacy) && typeof legacy.origin === "string" && legacy.origin.trim()) || "Join form";
}

/** Each member's newest linked application, by user id. */
export function newestByUser<A extends { user_id: string | null; created_at: string }>(apps: A[]): Map<string, A> {
  const out = new Map<string, A>();
  for (const a of apps) {
    const seen = a.user_id ? out.get(a.user_id) : undefined;
    if (a.user_id && (!seen || a.created_at > seen.created_at)) out.set(a.user_id, a);
  }
  return out;
}

/** Adds the applicant email (from her linked application, if any) to each profile. */
export function attachEmails<P extends { id: string }>(
  profiles: P[],
  applications: { user_id: string | null; email: string }[],
): (P & { email: string | null })[] {
  const emails = new Map<string, string>();
  for (const a of applications) if (a.user_id && !emails.has(a.user_id)) emails.set(a.user_id, a.email);
  return profiles.map((p) => ({ ...p, email: emails.get(p.id) ?? null }));
}

/** The reviewer's name when `reviewed_by` is a known, named profile; undefined otherwise (older reviews have none). */
export function reviewerName(reviewedBy: string | null, members: { id: string; full_name: string }[]): string | undefined {
  if (!reviewedBy) return undefined;
  return members.find((m) => m.id === reviewedBy)?.full_name.trim() || undefined;
}

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

/** A calendar date (YYYY-MM-DD) read at local noon, so it never shifts a day. */
export const formatDay = (day: string) =>
  new Date(`${day}T12:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

// ---------- Neighborhoods: mirrors the checks in migration 0001 ----------
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const NAME_MAX = 60;

/** An error message for the first invalid field, or null. Omit `slug` for an existing row (it can't change). */
export function validateNeighborhood(input: { name: string; color: string; slug?: string }): string | null {
  const name = input.name.trim();
  if (!name || name.length > NAME_MAX) return `Please give the neighborhood a name of 1–${NAME_MAX} characters.`;
  if (input.slug !== undefined && !SLUG_PATTERN.test(input.slug)) {
    return "The slug may use only lowercase letters, numbers and single hyphens between words (e.g. long-island-city).";
  }
  if (!COLOR_PATTERN.test(input.color)) return "Please choose the color as a hex value like #2f9dff.";
  return null;
}

// Mirrors the neighborhood-logos bucket: PNG or WebP, 2 MB.
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/webp": "webp" };

/** Returns the file extension for an acceptable logo, or throws a message an admin can act on. */
export function checkLogo(file: File): string {
  const ext = LOGO_TYPES[file.type];
  if (!ext) throw new Error("Please choose a PNG or WebP logo.");
  if (file.size > LOGO_MAX_BYTES) throw new Error("That logo is over 2 MB. Please choose a smaller one.");
  return ext;
}

/** `<slug>.<ext>` inside the neighborhood-logos bucket. */
export const logoPath = (slug: string, file: File) => `${slug}.${checkLogo(file)}`;

// ---------- Search (CRM-041) and CSV (CRM-186) ----------

/** Case- and accent-insensitive: every word of the query appears in one of the fields (name, email, business). */
export function matchesSearch(query: string, fields: (string | null | undefined)[]): boolean {
  const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const words = fold(query).split(/\s+/).filter(Boolean);
  const text = fold(fields.filter(Boolean).join(" "));
  return words.every((w) => text.includes(w));
}

/**
 * RFC 4180 CSV with a BOM and CRLF, as the CRM's responses.csv (CRM-130): every cell quoted, and one that starts
 * = + - @ tab or CR gets a leading ' so a spreadsheet never runs it as a formula.
 */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  return `\uFEFF${[header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`;
}
