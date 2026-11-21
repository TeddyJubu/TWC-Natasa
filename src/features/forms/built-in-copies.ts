// A built-in form as a custom-form definition, so an admin can duplicate it into an /f/… form and change it freely.
// Same questions and choices as the page; left out on purpose: consent statements, guidelines, signature, the
// newsletter opt-in and every other legal or wired-up part, which a custom form can't honour. Follow-up questions
// become plain optional ones (custom forms have no conditions). built-in-copies.test.ts checks every label against
// the page source, so a wording change on a page shows up here.
import {
  communityOptions, connectionOptions, directoryOptions, eventOptions, heardOptions, industryOptions, locationOptions, supportOptions,
} from "@/features/applications/schema";
import { TOPICS } from "@/features/contact/schema";
import { COLLABORATIONS } from "@/features/contact/partnership";
import type { CopyForm } from "@/features/form-copy/manifest";
import { CORRECTIONS, INFO_FIELDS, MEMBERSHIP, PERMISSIONS, PUBLIC_FIELDS } from "@/features/member-links/schema";
import { choiceValue } from "./form-draft";
import type { Choice, Question, QuestionType } from "./schema";

export type FormTemplate = { intro: string; thanks: string; questions: Question[] };

/** Choices from plain labels, with values made the way the question editor makes them. */
const pick = (labels: readonly string[]): Choice[] => {
  const taken: string[] = [];
  return labels.map((label) => { const value = choiceValue(label, taken); taken.push(value); return { value, label }; });
};
const opts = (list: readonly { value: string; label: string }[]): Choice[] => list.map(({ value, label }) => ({ value, label }));
const q = (key: string, type: QuestionType, label: string, required = false, extra: { help?: string; choices?: Choice[] } = {}): Question =>
  ({ key, type, label, required, ...extra });
const ALL = "Select all that apply.";
const yesNo = pick(["Yes", "No"]);

export const BUILT_IN_COPIES: Record<CopyForm, FormTemplate> = {
  application: {
    intro: "Complete this application so we can learn about you, your work, and how you would like to participate in The Women’s Collective.",
    thanks: "We are excited to learn more about you and your work. Your application will be reviewed, and we will contact you if we need anything else.",
    questions: [
      q("full_name", "short", "Full name", true),
      q("preferred_name", "short", "Preferred name"),
      q("pronouns", "short", "Pronouns"),
      q("email", "email", "Email address", true),
      q("phone", "phone", "Phone number", true),
      q("neighborhood", "dropdown", "Where are you based?", true, { choices: pick(locationOptions) }),
      q("connection", "checkboxes", "What is your connection to North Brooklyn?", true, { help: ALL, choices: pick(connectionOptions) }),
      q("business", "short", "Business or organization name"),
      q("role", "short", "Professional title or role", true),
      q("website", "url", "Business website"),
      q("instagram", "short", "Instagram"),
      q("linkedin", "url", "LinkedIn"),
      q("social", "url", "Other social or professional profile"),
      q("story", "paragraph", "Tell us about yourself and your work", true),
      q("industry", "checkboxes", "Industry", true, { help: ALL, choices: pick(industryOptions) }),
      q("other_industry", "short", "Describe your industry"),
      q("community_goals", "checkboxes", "What are you hoping to find through the collective?", true, { choices: pick(communityOptions) }),
      q("ideal_referral", "paragraph", "Your ideal referral or connection", true),
      q("community_support", "paragraph", "How can the community support you?"),
      q("member_support", "checkboxes", "How would you like to support other members?", true, { choices: pick(supportOptions) }),
      q("coffee", "radio", "Are you open to one-to-one meetings or coffee chats?", false, { choices: pick(["Yes — in person", "Yes — virtually", "Yes — either", "Not at this time"]) }),
      q("contact_preference", "checkboxes", "How do you prefer members to contact you?", false, { choices: pick(["Email", "Phone", "Text", "WhatsApp", "Instagram", "LinkedIn"]) }),
      q("local_shoutout", "paragraph", "Shout out a local business, organization, or resource you love"),
      q("whatsapp", "radio", "Would you like to join the WhatsApp community?", false, { choices: yesNo }),
      q("whatsapp_number", "phone", "WhatsApp phone number"),
      q("spotlight", "radio", "Would you like to be considered for a member spotlight?", false, { choices: pick(["Yes", "No", "Please contact me first"]) }),
      q("spotlight_focus", "paragraph", "What would you most like us to highlight?"),
      q("directory", "radio", "Would you like to apply for the public member directory?", false,
        { choices: opts([{ value: "yes", label: "Yes — apply" }, { value: "no", label: "No — keep my information private" }, { value: "info", label: "Send me more information first" }]) }),
      q("public_fields", "checkboxes", "Which information may be displayed publicly?", false, { choices: pick(directoryOptions) }),
      q("directory_email", "email", "Public directory email"),
      q("directory_phone", "phone", "Public directory phone"),
      q("directory_bio", "paragraph", "Directory biography", false, { help: "Write 50–100 words in the third person." }),
      q("services", "short", "Services or specialties", false, { help: "List up to five." }),
      q("headshot_contact", "radio", "How should we contact you to schedule your headshot?", false, { choices: pick(["Email", "Phone", "Text", "WhatsApp"]) }),
      q("events", "checkboxes", "How would you like to participate in events?", false, { choices: pick(eventOptions) }),
      q("partner", "radio", "Would you like to become a sponsor or community partner?", false, { choices: pick(["Yes", "Maybe", "No"]) }),
      q("partner_interest", "paragraph", "Describe your interest"),
      q("application_contact", "radio", "May we contact you directly about your application?", false, { choices: pick(["Email", "Phone", "Text", "WhatsApp", "Any of these"]) }),
      q("heard", "dropdown", "How did you hear about us?", false, { choices: pick(heardOptions) }),
      q("referrer", "short", "Name of the member who referred you"),
    ],
  },
  review: {
    intro: "Confirm or correct your details, then make each choice below separately. Nothing publishes automatically.",
    thanks: "Your choices have been recorded. A person will review them before anything changes.",
    questions: [
      ...INFO_FIELDS.map(({ name, label }) => q(name, name === "email" ? "email" : "short", label, name === "full_name" || name === "email")),
      q(MEMBERSHIP.name, "radio", MEMBERSHIP.legend, true, { choices: opts(MEMBERSHIP.options) }),
      ...PERMISSIONS.map((p) => q(p.name, "radio", p.legend, false, { choices: opts(p.options) })),
      q("public_fields", "checkboxes", "If public, which fields may appear?", false, { help: "Applies only to a public listing", choices: opts(PUBLIC_FIELDS) }),
      q("correction_requests", "checkboxes", "Corrections & removal requests", false, { help: "Tick anything you would like us to do. A person handles each request.", choices: opts(CORRECTIONS) }),
      q("other_note", "paragraph", "Anything we should correct, or details about your request"),
    ],
  },
  contact: {
    intro: "A question about membership, an idea for an event, a partnership you’d like to explore: send it our way. A real person in North Brooklyn reads every message.",
    thanks: "Thanks for reaching out.",
    questions: [
      q("name", "short", "Your name", true),
      q("email", "email", "Email", true),
      q("topic", "radio", "What’s it about?", true, { choices: pick(TOPICS) }),
      q("message", "paragraph", "Message", true),
    ],
  },
  partnership: {
    intro: "Every event happens because someone opens their doors and shares what they know. That’s a collaboration, and we treat it like one.",
    thanks: "Thanks for writing.",
    questions: [
      q("name", "short", "Your name", true),
      q("email", "email", "Email", true),
      q("business", "short", "Business", true),
      q("collaboration_type", "radio", "Type of collaboration", true, { choices: opts(COLLABORATIONS) }),
      q("message", "paragraph", "What did you have in mind?", true, { help: "A couple of sentences is plenty. Include your neighborhood if it’s relevant." }),
    ],
  },
};
