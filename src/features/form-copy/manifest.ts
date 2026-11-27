// Client-safe list of the wording an admin may change on each built-in form (no server imports).
// A text here is both the default shown on the page and the key its override is stored under (`form_copy.original`),
// so it must match the page's literal exactly; form-copy.test.ts checks every one against the source files.
// Not listed on purpose: consent statements, answer choices, notices and legal text. They stay fixed in code.

export const COPY_FORMS = ["application", "review", "contact", "partnership"] as const;
export type CopyForm = (typeof COPY_FORMS)[number];
export const isCopyForm = (value: unknown): value is CopyForm => COPY_FORMS.includes(value as CopyForm);

export const COPY_MAX = 2000;
/** Longer than this and the editor shows a textarea instead of a single line. */
export const LONG_TEXT = 90;

export type CopyField = { group: string; text: string };
const g = (group: string, texts: string[]): CopyField[] => texts.map((text) => ({ group, text }));

export const COPY_FIELDS: Record<CopyForm, CopyField[]> = {
  application: [
    ...g("Top of the page", [
      "psst — there’s a seat for you",
      "Membership application",
      "Tell us about your place in the constellation.",
      "Complete this application so we can learn about you, your work, and how you would like to participate in The Women’s Collective.",
      "Seven short sections. Your answers save on this device as you go.",
    ]),
    ...g("01 — Personal information", [
      "Start with you.", "Private details stay private unless you explicitly authorize publication.",
      "Full name", "Preferred name", "Pronouns", "Email address", "Phone number", "Where are you based?",
      "What is your connection to North Brooklyn?", "What is your connection to Queens?", "Select all that apply.",
    ]),
    ...g("02 — About your work", [
      "Share what you do.", "Help members understand your work in your own words.",
      "Business or organization name", "Professional title or role", "Business website", "Instagram", "LinkedIn",
      "Other social or professional profile", "Tell us about yourself and your work", "Industry", "Describe your industry",
    ]),
    ...g("03 — Community connections", [
      "Find your people.", "Tell us what meaningful support looks like for you.",
      "What are you hoping to find through the collective?", "Your ideal referral or connection",
      "How can the community support you?", "How would you like to support other members?",
      "Are you open to one-to-one meetings or coffee chats?", "How do you prefer members to contact you?",
      "Shout out a local business, organization, or resource you love",
    ]),
    ...g("04 — Events and partnerships", [
      "Take part your way.", "Attend, contribute, host, or collaborate.", "How would you like to participate in events?",
      "Would you like to become a sponsor or community partner?", "Describe your interest",
    ]),
    ...g("05 — Communication", [
      "Stay in the loop.", "Choose what reaches your inbox.",
      "Receive news, event invitations, opportunities, and updates?", "May we contact you directly about your application?",
    ]),
    ...g("06 — Community guidelines", ["Keep it generous.", "Confirm each commitment before submitting."]),
    ...g("07 — Final confirmation", [
      "Make it official.", "One final review, then send.", "How did you hear about us?", "Name of the member who referred you",
    ]),
    ...g("Button and thank-you", [
      "Submit application", "Application received", "Thank you for introducing yourself.",
      "We are excited to learn more about you and your work. Your application will be reviewed, and we will contact you if we need anything else.",
    ]),
  ],
  review: [
    ...g("Top of the page", [
      "Existing members",
      "Member information & permissions review",
      "Hello {name} — this private page shows your own record only. Confirm or correct your details, then make each choice below separately. Nothing publishes automatically.",
    ]),
    ...g("01 — Your information", [
      "Your information", "Prefilled from our private records. Correct anything that has changed.",
      "Full name", "Email", "Business or practice", "Profession or role", "Website or public social link",
      "Broad neighborhood or city", "Interests",
    ]),
    ...g("02 — Membership", ["Membership", "Choose one.", "Would you like to stay part of The Women’s Collective?"]),
    ...g("03 — Permissions", [
      "Your permissions, separately", "Each of these is its own decision. Say yes, no, or leave anything blank.",
      "Newsletter", "Directory", "Photography / video", "Partner communications", "Introductions",
    ]),
    ...g("04 — Corrections", [
      "Corrections & removal requests", "Tick anything you would like us to do. A person handles each request.",
      "Anything we should correct, or details about your request",
    ]),
    ...g("Button and thank-you", [
      "Submit my review", "Response received", "Thank you — your response is saved.",
      "Your choices have been recorded. A person will review them before anything changes.",
    ]),
  ],
  contact: [
    ...g("Top of the page", [
      "say hello",
      "Say hello, neighbor.",
      "A question about membership, an idea for an event, a partnership you’d like to explore: send it our way. A real person reads every message.",
    ]),
    ...g("The form", ["Your name", "Email", "What’s it about?", "Message", "Send message"]),
    ...g("Thank-you", ["Message received", "Thanks for reaching out."]),
  ],
  partnership: [
    ...g("Top of the page", [
      "Work with us",
      "Ways to partner",
      "Whether you’re a neighborhood business, a global brand or someone who wants to give back, there is a way to partner that fits your goals and budget.",
    ]),
    ...g("Next to the form", ["Talk to us"]),
    ...g("The form", [
      "Your name", "Email", "Business", "Type of collaboration", "What did you have in mind?",
      "A couple of sentences is plenty. Include your neighborhood if it’s relevant.", "Send inquiry",
    ]),
    ...g("Thank-you", ["Inquiry received", "Thanks for writing."]),
  ],
};

/** The forms the admin's list shows: the five built-in ones. Custom `/f/…` forms come from the database. */
export const BUILT_IN = ["application", "review", "contact", "partnership", "newsletter"] as const;
export type BuiltIn = (typeof BUILT_IN)[number];
export const isBuiltIn = (value: unknown): value is BuiltIn => BUILT_IN.includes(value as BuiltIn);

export const BUILT_IN_INFO: Record<BuiltIn, { title: string; href?: string; answers: [label: string, href: string]; note: string }> = {
  application: { title: "Membership application", href: "/join", answers: ["Applications", "/admin/applications"], note: "The membership application. Can be closed." },
  review: { title: "Member review", href: "/review", answers: ["Member reviews", "/admin/reviews"], note: "Personal single-use links for current members. Can be closed." },
  contact: { title: "Contact", href: "/contact", answers: ["Inbox", "/admin/inbox"], note: "Always on." },
  partnership: { title: "Partnership", href: "/partnerships", answers: ["Inbox", "/admin/inbox"], note: "Always on." },
  newsletter: { title: "Newsletter", answers: ["Newsletter", "/admin/newsletter"], note: "No public signup page yet; sign-ups come from the membership application’s opt-in." },
};
