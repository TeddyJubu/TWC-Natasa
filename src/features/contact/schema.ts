// The /contact message: its shape, limits, and the one check both the form (inline errors) and the server
// (POST /api/contact, defence in depth) run. Plain strings only — the server sends it as a plain-text email.

export const TOPICS = [
  "A question about membership",
  "Hosting or sponsoring a gathering",
  "Partnerships",
  "Press",
  "Something else",
] as const;
export type Topic = (typeof TOPICS)[number];

export const LIMITS = { name: 120, email: 254, message: 5000 } as const;
/** Same rule as the applications.email check in migration 0001. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type ContactInput = { name: string; email: string; topic: Topic; message: string };
export type ContactField = keyof ContactInput;
export type ContactErrors = Partial<Record<ContactField, string>>;

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The trimmed message, or the problems with it, one per field (in form order). */
export function checkContact(input: Record<string, unknown>): { value: ContactInput } | { errors: ContactErrors } {
  const name = text(input.name);
  const email = text(input.email);
  const topic = text(input.topic);
  const message = text(input.message);
  const errors: ContactErrors = {};
  if (!name) errors.name = "Please tell us your name.";
  else if (name.length > LIMITS.name) errors.name = `Please keep your name under ${LIMITS.name} characters.`;
  if (!email) errors.email = "Please give us an email so we can reply.";
  else if (email.length > LIMITS.email || !EMAIL.test(email)) errors.email = "Please check your email: it should look like name@example.com.";
  if (!TOPICS.includes(topic as Topic)) errors.topic = "Please choose what it’s about.";
  if (!message) errors.message = "Please write a message.";
  else if (message.length > LIMITS.message) errors.message = `Please keep your message under ${LIMITS.message} characters.`;
  return Object.keys(errors).length ? { errors } : { value: { name, email, topic: topic as Topic, message } };
}
