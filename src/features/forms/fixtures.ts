// Made-up forms for tests and local runs (scripts/seed-forms.ts), so /f/<slug> works without the VPS's data. Never
// real people or real events.
import type { FormDefinition } from "./store.ts";

export const DEMO_FORMS: FormDefinition[] = [
  {
    id: "demo0001",
    slug: "salon-rsvp",
    old_slugs: ["salon-rsvp-old"],
    name: "Salon RSVP (demo)",
    intro: "Made-up form for tests.\n\nTell us if you’re coming.",
    thanks: "Thank you — we’ve got your RSVP.\n\nA person reads every answer.",
    one_per_email: true,
    questions: [
      { key: "name", type: "short", label: "Your name", required: true },
      { key: "email", type: "email", label: "Email", required: true },
      { key: "coming", type: "radio", label: "Are you coming?", required: true, choices: [{ value: "yes", label: "Yes" }, { value: "maybe", label: "Maybe" }, { value: "no", label: "No" }] },
      { key: "diet", type: "checkboxes", label: "Anything we should know?", choices: [{ value: "vegetarian", label: "Vegetarian" }, { value: "vegan", label: "Vegan" }, { value: "no-nuts", label: "No nuts" }] },
      { key: "plus_one", type: "yesno", label: "Bringing a guest?" },
      { key: "note", type: "paragraph", label: "Anything else?", help: "Optional." },
    ],
  },
  {
    id: "demo0002",
    slug: "old-survey",
    name: "Old survey (demo, closed)",
    open: false,
    closed_message: "This survey has closed. Thank you to everyone who answered.",
    questions: [{ key: "feedback", type: "paragraph", label: "Your feedback", required: true }],
  },
];
