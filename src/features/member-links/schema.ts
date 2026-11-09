// The member review form (/review?t=…, inventory backoffice.md §2a, form version 1): its verbatim labels and
// options, and the one check both the form (inline errors) and the server (POST /api/review) run. Answers are
// stored as-is in member_reviews.answers (migration 0003); nothing here ever writes to the member's profile.

type Opt = { value: string; label: string };

export const FORM_VERSION = 1;
export const LIMITS = { name: 120, email: 254, text: 300, note: 4000 } as const;
/** Same rule as the applications.email check in migration 0001. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const INFO_FIELDS = [
  { name: "full_name", label: "Full name" },
  { name: "email", label: "Email" },
  { name: "business_practice", label: "Business or practice" },
  { name: "profession_role", label: "Profession or role" },
  { name: "website_social", label: "Website or public social link" },
  { name: "neighborhood_city", label: "Broad neighborhood or city" },
  { name: "interests", label: "Interests" },
] as const;
export type InfoField = (typeof INFO_FIELDS)[number]["name"];

export const MEMBERSHIP = {
  name: "membership",
  legend: "Would you like to stay part of The Women’s Collective?",
  options: [
    { value: "keep", label: "Yes, keep me connected to the free community of The Women’s Collective." },
    { value: "leave", label: "No, I want to leave and request removal of my active member information." },
    { value: "contact_me", label: "I am not sure; please contact me." },
  ],
} as const;

/** Section 03: each is its own optional decision; blank stays unanswered, never a yes (OPS-146, OPS-115). */
export const PERMISSIONS = [
  { name: "newsletter", legend: "Newsletter", options: [
    { value: "yes", label: "Yes, subscribe me to The Women’s Collective newsletter." },
    { value: "no", label: "No, do not subscribe me." },
  ] },
  { name: "directory", legend: "Directory", options: [
    { value: "none", label: "Do not list me." },
    { value: "member_only", label: "Member-only listing." },
    { value: "public", label: "Public listing." },
  ] },
  { name: "photography", legend: "Photography / video", options: [
    { value: "yes", label: "Yes, I consent to identifiable event photography/video by The Women’s Collective." },
    { value: "no", label: "No, I do not consent." },
    { value: "ask_first", label: "Ask me before using an identifiable image publicly." },
  ] },
  { name: "partner_comms", legend: "Partner communications", options: [
    { value: "yes", label: "Yes, I am open to clearly identified partner opportunities from The Women’s Collective." },
    { value: "no", label: "No, please do not send partner-related messages." },
    { value: "ask_first", label: "Ask me about each opportunity individually." },
  ] },
  { name: "introductions", legend: "Introductions", options: [
    { value: "open", label: "I am open to thoughtful introductions when there is a clear mutual reason." },
    { value: "ask_first", label: "Please ask me before making introductions." },
  ] },
] as const satisfies readonly { name: string; legend: string; options: readonly Opt[] }[];
export type PermissionField = (typeof PERMISSIONS)[number]["name"];

/** The 12 public-directory fields (the old intake's PUBLIC_FIELDS). */
export const PUBLIC_FIELDS: readonly Opt[] = [
  { value: "public_name", label: "Name" },
  { value: "public_business_name", label: "Business name" },
  { value: "public_profession_role", label: "Profession or role" },
  { value: "public_short_bio", label: "Business description or directory biography" },
  { value: "public_broad_area", label: "Neighborhood" },
  { value: "public_website", label: "Website" },
  { value: "public_instagram", label: "Instagram" },
  { value: "public_linkedin", label: "LinkedIn" },
  { value: "public_email", label: "Public email address" },
  { value: "public_phone", label: "Public business phone number" },
  { value: "public_services", label: "Services or specialties" },
  { value: "public_logo", label: "Business logo" },
];

export const CORRECTIONS: readonly Opt[] = [
  { value: "req_info_correction", label: "Information correction" },
  { value: "req_newsletter_unsubscribe", label: "Newsletter unsubscribe" },
  { value: "req_public_directory_removal", label: "Public directory removal" },
  { value: "req_member_only_removal", label: "Member-only directory removal" },
  { value: "req_record_removal", label: "Active member-record removal" },
  { value: "req_other", label: "Other request" },
];

export type ReviewAnswers = Record<InfoField, string> & Partial<Record<PermissionField, string>> & {
  membership: "keep" | "leave" | "contact_me";
  public_fields: string[];
  correction_requests: string[];
  other_note: string;
};
export type ReviewField = keyof ReviewAnswers;
export type ReviewErrors = Partial<Record<ReviewField, string>>;

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown) => (Array.isArray(v) ? v : v === undefined || v === "" ? [] : [v]).filter((x): x is string => typeof x === "string");
const values = (opts: readonly Opt[]) => opts.map((o) => o.value);

/**
 * The trimmed review, or its problems (first one = first field to fix). Unlike the old intake, every radio and
 * checkbox value is checked against its options; an unanswered permission is left out.
 */
export function checkReview(input: Record<string, unknown>): { value: ReviewAnswers } | { errors: ReviewErrors } {
  const errors: ReviewErrors = {};
  const info = Object.fromEntries(INFO_FIELDS.map(({ name }) => [name, text(input[name])])) as Record<InfoField, string>;
  if (!info.full_name) errors.full_name = "Please tell us your name.";
  else if (info.full_name.length > LIMITS.name) errors.full_name = `Please keep your name under ${LIMITS.name} characters.`;
  if (!info.email) errors.email = "Please give us your email.";
  else if (info.email.length > LIMITS.email || !EMAIL.test(info.email)) errors.email = "Please check your email: it should look like name@example.com.";
  info.email = info.email.toLowerCase();
  for (const { name, label } of INFO_FIELDS.slice(2)) {
    if (info[name].length > LIMITS.text) errors[name] = `Please keep “${label}” under ${LIMITS.text} characters.`;
  }

  const membership = text(input.membership);
  if (!values(MEMBERSHIP.options).includes(membership)) errors.membership = "Please choose whether you would like to stay connected.";

  const permissions: Partial<Record<PermissionField, string>> = {};
  for (const p of PERMISSIONS) {
    const v = text(input[p.name]);
    if (!v) continue;
    if (values(p.options).includes(v)) permissions[p.name] = v;
    else errors[p.name] = `Please choose one of the “${p.legend}” options.`;
  }
  const public_fields = list(input.public_fields);
  if (public_fields.some((f) => !values(PUBLIC_FIELDS).includes(f))) errors.public_fields = "Please choose fields from the list.";
  else if (permissions.directory === "public" && public_fields.length === 0) {
    errors.public_fields = "You chose a public listing — please tick at least one field that may appear.";
  }
  const correction_requests = list(input.correction_requests);
  if (correction_requests.some((c) => !values(CORRECTIONS).includes(c))) errors.correction_requests = "Please choose requests from the list.";
  const other_note = text(input.other_note);
  if (other_note.length > LIMITS.note) errors.other_note = `Please keep this under ${LIMITS.note} characters.`;

  if (Object.keys(errors).length) {
    const order: ReviewField[] = [...INFO_FIELDS.map((f) => f.name), "membership", "newsletter", "directory", "public_fields", "photography",
      "partner_comms", "introductions", "correction_requests", "other_note"];
    return { errors: Object.fromEntries(order.filter((k) => errors[k]).map((k) => [k, errors[k]])) };
  }
  return {
    value: {
      ...info, membership: membership as ReviewAnswers["membership"], ...permissions,
      // Public fields only mean something for a public listing.
      public_fields: permissions.directory === "public" ? public_fields : [],
      correction_requests, other_note,
    },
  };
}

/** A stored review as labelled rows for /admin: verbatim labels, option labels instead of codes, blanks left out. */
export function reviewEntries(answers: Record<string, unknown>): { key: string; label: string; value: string | string[] }[] {
  const label = (opts: readonly Opt[], v: unknown) => opts.find((o) => o.value === v)?.label ?? String(v);
  const rows: { key: string; label: string; value: string | string[] }[] = [];
  for (const { name, label: l } of INFO_FIELDS) if (text(answers[name])) rows.push({ key: name, label: l, value: text(answers[name]) });
  if (answers.membership) rows.push({ key: "membership", label: "Membership", value: label(MEMBERSHIP.options, answers.membership) });
  for (const p of PERMISSIONS) if (answers[p.name]) rows.push({ key: p.name, label: p.legend, value: label(p.options, answers[p.name]) });
  const fields = list(answers.public_fields);
  if (fields.length) rows.push({ key: "public_fields", label: "Public fields", value: fields.map((f) => label(PUBLIC_FIELDS, f)) });
  const requests = list(answers.correction_requests);
  if (requests.length) rows.push({ key: "correction_requests", label: "Requests", value: requests.map((r) => label(CORRECTIONS, r)) });
  if (text(answers.other_note)) rows.push({ key: "other_note", label: "Details", value: text(answers.other_note) });
  return rows;
}
