// The /partnerships inquiry: its shape, limits and the one check both the form (inline errors) and the future
// server run. The wire shape is the contract in migration/briefs/admin-inbox.md; admin-inbox owns storage.
// ponytail: the email rule is repeated from schema.ts so this file never collides with the inbox work on it.

export const COLLABORATIONS = [
  { value: "host", label: "Host — open your space" },
  { value: "teach", label: "Teach — share what you know" },
  { value: "supply", label: "Supply — feed the room" },
  { value: "support", label: "Support — underwrite a series" },
  { value: "other", label: "Something else" },
] as const;
export type Collaboration = (typeof COLLABORATIONS)[number]["value"];

export const PARTNERSHIP_LIMITS = { name: 120, email: 254, business: 160, message: 2000 } as const;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Exactly what POST /api/partnerships accepts. */
export type PartnershipInput = {
  kind: "partnership";
  name: string;
  email: string;
  business: string;
  collaboration_type: Collaboration;
  message: string;
  consent: true;
  /** A field people never see: a bot that fills it is thanked and dropped by the server. */
  honeypot: string;
};
export type PartnershipField = "name" | "email" | "business" | "collaboration_type" | "message" | "consent";
export type PartnershipErrors = Partial<Record<PartnershipField, string>>;

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The trimmed inquiry, or the problems with it, one per field (in form order). */
export function checkPartnership(input: Record<string, unknown>): { value: PartnershipInput } | { errors: PartnershipErrors } {
  const name = text(input.name);
  const email = text(input.email);
  const business = text(input.business);
  const collaboration = text(input.collaboration_type);
  const message = text(input.message);
  const L = PARTNERSHIP_LIMITS;
  const errors: PartnershipErrors = {};
  if (!name) errors.name = "Please tell us your name.";
  else if (name.length > L.name) errors.name = `Please keep your name under ${L.name} characters.`;
  if (!email) errors.email = "Please give us an email so we can reply.";
  else if (email.length > L.email || !EMAIL.test(email)) errors.email = "Please check your email: it should look like name@example.com.";
  if (!business) errors.business = "Please tell us the name of your business.";
  else if (business.length > L.business) errors.business = `Please keep that under ${L.business} characters.`;
  if (!COLLABORATIONS.some((c) => c.value === collaboration)) errors.collaboration_type = "Please choose a kind of collaboration.";
  if (!message) errors.message = "Please write a few sentences.";
  else if (message.length > L.message) errors.message = `Please keep your message under ${L.message} characters.`;
  // A form posts a checked box as "on"; JSON clients send true.
  if (!(input.consent === true || input.consent === "on")) errors.consent = "Please tick the box so we may hold your details to reply.";
  if (Object.keys(errors).length) return { errors };
  return {
    value: {
      kind: "partnership", name, email, business, collaboration_type: collaboration as Collaboration, message, consent: true,
      honeypot: typeof input.honeypot === "string" ? input.honeypot : "",
    },
  };
}
