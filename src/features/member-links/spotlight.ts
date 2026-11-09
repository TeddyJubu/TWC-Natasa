// The Weekly Spotlight form (/spotlight?t=…, inventory backoffice.md §2b, OPS-029): verbatim labels, the old Google
// Form column names as stored answer keys, and the one check both the form and POST /api/spotlight run. Answers are
// stored as-is in spotlight_answers (migration 0008); nothing here ever writes to the member's profile.

/** The old intake's words (MF:1146-1152), one answer for every token that doesn't open the form. */
export const INVALID_SPOTLIGHT = "This personal Spotlight link is invalid, expired, or has already been used. Every member link opens only one time and only for one person. If you think something went wrong, reply to the message your link came in and we will send a fresh one.";

export const SPOTLIGHT_LIMITS = { identity: 300, answer: 2000 } as const;

type Question = { key: string; label: string; section: 2 | 3; required?: true; kind?: "yesno" | "url"; help?: string };

/** `key` is the stored answer key (an old Google Form column, kept verbatim so imported and new answers line up). */
export const SPOTLIGHT_QUESTIONS: readonly Question[] = [
  { key: "What Inspired You to Start", label: "What inspired you to start your business or practice?", section: 2, required: true },
  { key: "What Are You Currently Focused On", label: "What are you working on right now?", section: 2, required: true },
  { key: "What Are You Most Proud Of", label: "What are you most proud of so far?", section: 2, required: true },
  { key: "One Fact Others Should Know", label: "Tell us one thing people might not know about you.", section: 2, required: true },
  { key: "Booking / Promo Links", label: "Where can people book you or find your current offer?", section: 2, help: "Your website, booking page, shop or an offer — paste the links." },
  { key: "Coffee With Interview Opt-In", label: "Would you like to be interviewed for our “Coffee with…” series?", section: 2, kind: "yesno" },
  { key: "NBWC Event Promo Collaboration", label: "Have an event coming up that we could help promote?", section: 2, help: "Tell us what it is, when and where." },
  { key: "Community - See More Of", label: "What would you love to see more of in the Collective?", section: 3 },
  { key: "Community - Suggestions / Events", label: "Any ideas for events or gatherings?", section: 3 },
  { key: "Community - Never Do", label: "Is there anything the Collective should never do?", section: 3 },
  { key: "Community - Would Feel Magical", label: "What would make being part of the Collective feel magical?", section: 3 },
  { key: "Community - North Brooklyn Means", label: "What does North Brooklyn mean to you?", section: 3 },
  { key: "Community - Remember You", label: "What would you like other members to remember about you?", section: 3 },
  { key: "Reel Upload", label: "Have a short video or reel? Share the link.", section: 3, kind: "url", help: "Optional — a link from Instagram, Google Drive or similar." },
];

/** The old form's POST name: `q_` + the key lower-cased, non-alphanumeric runs as `_` (MF:1100-1101). */
export const fieldName = (key: string) => `q_${key.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;

export const IDENTITY = [
  { name: "full_name", label: "Your name" },
  { name: "business", label: "Business name" },
  { name: "neighborhood", label: "Neighborhood" },
] as const;
export type IdentityField = (typeof IDENTITY)[number]["name"];

export type SpotlightValue = Record<IdentityField, string> & { answers: Record<string, string> };
/** Errors by POST name (`full_name`, `q_…`), in form order. */
export type SpotlightErrors = Record<string, string>;

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const URL_RE = /^https?:\/\/[^\s/]+\.[^\s]+$/i;

/** The trimmed answers keyed by their old column names (blanks left out), or the problems in form order. */
export function checkSpotlight(input: Record<string, unknown>): { value: SpotlightValue } | { errors: SpotlightErrors } {
  const errors: SpotlightErrors = {};
  const id = Object.fromEntries(IDENTITY.map(({ name }) => [name, text(input[name])])) as Record<IdentityField, string>;
  if (!id.full_name) errors.full_name = "Please enter your name.";
  for (const { name, label } of IDENTITY) {
    if (id[name].length > SPOTLIGHT_LIMITS.identity) errors[name] = `Please keep “${label}” under ${SPOTLIGHT_LIMITS.identity} characters.`;
  }
  const answers: Record<string, string> = {};
  for (const q of SPOTLIGHT_QUESTIONS) {
    const name = fieldName(q.key);
    const v = text(input[name]);
    if (!v) {
      if (q.required) errors[name] = `Please answer: ${q.label}`;
      continue;
    }
    if (q.kind === "yesno" && v !== "Yes" && v !== "No") errors[name] = `Please choose Yes or No for: ${q.label}`;
    else if (q.kind === "url" && !URL_RE.test(v)) errors[name] = "Please enter the video link as a complete http:// or https:// link.";
    else if (v.length > SPOTLIGHT_LIMITS.answer) errors[name] = `Please keep this answer under ${SPOTLIGHT_LIMITS.answer} characters: ${q.label}`;
    else answers[q.key] = v;
  }
  if (Object.keys(errors).length) {
    const order = [...IDENTITY.map((f) => f.name), ...SPOTLIGHT_QUESTIONS.map((q) => fieldName(q.key))];
    return { errors: Object.fromEntries(order.filter((k) => errors[k]).map((k) => [k, errors[k]!])) };
  }
  return { value: { ...id, answers } };
}

/**
 * Stored answers as labelled rows for /admin, in form order: the question's words for known keys, and an imported
 * row's unknown keys (an older Google Form column) after them under their own name.
 */
export function spotlightEntries(answers: Record<string, unknown>): { key: string; label: string; value: string }[] {
  const known = new Set(SPOTLIGHT_QUESTIONS.map((q) => q.key));
  const rows = SPOTLIGHT_QUESTIONS.filter((q) => text(answers[q.key])).map((q) => ({ key: q.key, label: q.label, value: text(answers[q.key]) }));
  for (const [key, v] of Object.entries(answers)) if (!known.has(key) && text(v)) rows.push({ key, label: key, value: text(v) });
  return rows;
}
