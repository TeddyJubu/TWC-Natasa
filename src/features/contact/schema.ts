// The /contact message and the /partnerships inquiry: their shapes, limits, and the one check both the forms
// (inline errors) and the server (POST /api/contact, /api/partnerships; defence in depth) run. Plain strings only —
// the server stores them (inbox_messages, migration 0002) and sends them as plain-text email.

export const TOPICS = [
  "A question about membership",
  "Hosting or sponsoring a gathering",
  "Partnerships",
  "Press",
  "Nominating someone for Member Monday",
  "Accessibility",
  "Reporting conduct",
  "Something else",
] as const;
export type Topic = (typeof TOPICS)[number];

/** The old partnerships form's five values (SITE-057); the same set is a CHECK in migration 0002. */
export const COLLABORATION_TYPES = ["host", "teach", "supply", "support", "other"] as const;
export type CollaborationType = (typeof COLLABORATION_TYPES)[number];

export const LIMITS = { name: 120, email: 254, business: 120, message: 5000 } as const;
/** Same rule as the applications.email check in migration 0001. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Person = { name: string; email: string; message: string; consent: true };
export type ContactInput = Person & { topic: Topic };
export type PartnershipInput = Person & { business: string; collaboration_type: CollaborationType };
export type ContactField = keyof ContactInput;
export type ContactErrors = Partial<Record<ContactField, string>>;
export type PartnershipErrors = Partial<Record<keyof PartnershipInput, string>>;

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
/** A checkbox sends "on" in a form post; JSON callers send true. */
const ticked = (v: unknown) => v === true || v === "on";

/** The fields both forms share, trimmed, with their problems added to `errors`. */
function checkPerson(input: Record<string, unknown>, errors: Partial<Record<keyof Person, string>>): Person {
  const name = text(input.name);
  const email = text(input.email);
  const message = text(input.message);
  if (!name) errors.name = "Please tell us your name.";
  else if (name.length > LIMITS.name) errors.name = `Please keep your name under ${LIMITS.name} characters.`;
  if (!email) errors.email = "Please give us an email so we can reply.";
  else if (email.length > LIMITS.email || !EMAIL.test(email)) errors.email = "Please check your email: it should look like name@example.com.";
  if (!message) errors.message = "Please write a message.";
  else if (message.length > LIMITS.message) errors.message = `Please keep your message under ${LIMITS.message} characters.`;
  if (!ticked(input.consent)) errors.consent = "Please tick the box so we can hold your details to reply.";
  return { name, email, message, consent: true };
}

/** The trimmed message, or the problems with it, one per field (in form order). */
export function checkContact(input: Record<string, unknown>): { value: ContactInput } | { errors: ContactErrors } {
  const errors: ContactErrors = {};
  const { name, email, message, consent } = checkPerson(input, errors);
  const topic = text(input.topic);
  if (!TOPICS.includes(topic as Topic)) errors.topic = "Please choose what it’s about.";
  return Object.keys(errors).length
    ? { errors: order(errors, ["name", "email", "topic", "message", "consent"]) }
    : { value: { name, email, topic: topic as Topic, message, consent } };
}

/** The trimmed inquiry, or the problems with it, one per field (in form order). Business is optional. */
export function checkPartnership(input: Record<string, unknown>): { value: PartnershipInput } | { errors: PartnershipErrors } {
  const errors: PartnershipErrors = {};
  const { name, email, message, consent } = checkPerson(input, errors);
  const business = text(input.business);
  const type = text(input.collaboration_type);
  if (business.length > LIMITS.business) errors.business = `Please keep your business name under ${LIMITS.business} characters.`;
  if (!COLLABORATION_TYPES.includes(type as CollaborationType)) errors.collaboration_type = "Please choose how you’d like to work with us.";
  return Object.keys(errors).length
    ? { errors: order(errors, ["name", "business", "email", "collaboration_type", "message", "consent"]) }
    : { value: { name, email, business, collaboration_type: type as CollaborationType, message, consent } };
}

/** The same errors with keys in form order, so the first one is the first field to fix. */
function order<K extends string>(errors: Partial<Record<K, string>>, keys: K[]): Partial<Record<K, string>> {
  return Object.fromEntries(keys.filter((k) => errors[k]).map((k) => [k, errors[k]])) as Partial<Record<K, string>>;
}
