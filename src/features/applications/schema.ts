// The /join application: the typed shape stored in `applications.answers`, and the FormData parser that
// builds it. Native validation runs first in the browser; this re-checks every requirement (defence in depth).

/** The six community guidelines. Each is a separate commitment and every one must be accepted. */
export const GUIDELINES = [
  "I will treat members with respect and professionalism.",
  "I will not use the community for spam, aggressive sales, or mass messaging.",
  "I will protect other members’ personal and business information.",
  "I understand the community is for genuine relationships, local connection, and collaboration.",
  "I understand membership and directory publication are subject to review.",
  "I confirm that this application is accurate and I may represent the business listed.",
] as const;

/** Location choices that ask the applicant to type where she is based. */
export const TYPED_LOCATIONS = ["Another Queens neighborhood", "Other"];

/** Mirrors the `applications` table checks in migration 0001; `answersBytes` keeps a margin under the 32 KB jsonb check. */
export const LIMITS = { fullName: 120, email: 254, neighborhood: 60, text: 2000, answersBytes: 30 * 1024 } as const;
/** The `applications.email` check in migration 0001. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface ApplicationAnswers {
  preferredName?: string;
  pronouns?: string;
  phone: string;
  /** The option chosen under "Where are you based?"; the typed place (if any) is the application's `neighborhood`. */
  basedIn: string;
  connection: string[];
  business?: string;
  role: string;
  website?: string;
  instagram?: string;
  linkedin?: string;
  otherProfile?: string;
  story: string;
  industry: string[];
  otherIndustry?: string;
  communityGoals: string[];
  idealReferral: string;
  communitySupport?: string;
  memberSupport: string[];
  coffee?: string;
  contactPreference?: string[];
  localShoutout?: string;
  whatsapp: { join: false } | { join: true; number: string; numberVisible: true; keepRespectful: true };
  spotlight: { choice: "no" | "Please contact me first" } | { choice: "yes"; focus: string; publicationConsent: true };
  directory:
    | { choice: "no" | "info" }
    | {
        choice: "yes";
        publicFields?: string[];
        email?: string;
        phone?: string;
        bio: string;
        services: string;
        publicationConsent: true;
        headshot: {
          contact?: string;
          paidSession: true;
          officialOnly: true;
          photoConsent: true;
          extraFees: true;
          placementNotGuaranteed: true;
        };
      };
  events?: string[];
  partner: { choice: "no" } | { choice: "yes" | "maybe"; interest: string };
  newsletter: { subscribe: false } | { subscribe: true; emailConsent: true };
  applicationContact?: string;
  communityGuidelines: true;
  heardAbout?: string;
  referrer?: string;
  signature: string;
  date: string;
  finalConfirmation: true;
}

export type ApplicationInput = {
  email: string;
  fullName: string;
  neighborhood: string;
  answers: ApplicationAnswers;
};

class Reader {
  constructor(private form: FormData) {}

  text(name: string): string | undefined {
    const value = this.form.get(name);
    const trimmed = typeof value === "string" ? value.trim() : "";
    return trimmed || undefined;
  }

  required(name: string, label: string): string {
    const value = this.text(name);
    if (!value) throw new Error(`Please answer “${label}”.`);
    return value;
  }

  list(name: string): string[] | undefined {
    const values = this.form.getAll(name).flatMap((v) => (typeof v === "string" && v.trim() ? [v.trim()] : []));
    return values.length ? values : undefined;
  }

  requiredList(name: string, label: string): string[] {
    const values = this.list(name);
    if (!values) throw new Error(`Please choose at least one answer for “${label}”.`);
    return values;
  }

  checked(name: string): boolean {
    return this.form.get(name) !== null;
  }

  consent(name: string, statement: string): true {
    if (!this.checked(name)) throw new Error(`Please confirm: “${statement}”`);
    return true;
  }
}

/** Drops keys whose value is undefined, so optional answers left blank are absent rather than null. */
const compact = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

export function parseApplication(form: FormData): ApplicationInput {
  const r = new Reader(form);

  const fullName = r.required("full-name", "Full name");
  if (fullName.length > LIMITS.fullName) throw new Error(`Please keep your name under ${LIMITS.fullName} characters.`);
  const email = r.required("email", "Email address");
  if (email.length > LIMITS.email || !EMAIL.test(email)) {
    throw new Error("Please check “Email address”: it should look like name@example.com.");
  }
  const basedIn = r.required("neighborhood", "Where are you based?");
  const neighborhood = TYPED_LOCATIONS.includes(basedIn) ? r.required("other-location", "Tell us where you are based") : basedIn;
  if (neighborhood.length > LIMITS.neighborhood) throw new Error(`Please keep your location under ${LIMITS.neighborhood} characters.`);

  const industry = r.requiredList("industry", "Industry");

  const whatsapp: ApplicationAnswers["whatsapp"] = r.text("whatsapp") === "yes"
    ? {
        join: true,
        number: r.required("whatsapp-number", "WhatsApp phone number"),
        numberVisible: r.consent("whatsapp-visibility", "I understand my phone number will be visible to group members."),
        keepRespectful: r.consent("whatsapp-conduct", "I will keep the space respectful and free from spam or harassment."),
      }
    : { join: false };

  const spotlightChoice = r.text("spotlight");
  const spotlight: ApplicationAnswers["spotlight"] = spotlightChoice === "yes"
    ? {
        choice: "yes",
        focus: r.required("spotlight-focus", "What would you most like us to highlight?"),
        publicationConsent: r.consent("spotlight-consent", "I authorize a member spotlight."),
      }
    : { choice: spotlightChoice === "Please contact me first" ? spotlightChoice : "no" };

  const directoryChoice = r.text("directory");
  const directory: ApplicationAnswers["directory"] = directoryChoice === "yes"
    ? compact({
        choice: "yes" as const,
        publicFields: r.list("public-fields"),
        email: r.text("directory-email"),
        phone: r.text("directory-phone"),
        bio: r.required("directory-bio", "Directory biography"),
        services: r.required("services", "Services or specialties"),
        publicationConsent: r.consent("directory-consent", "I authorize publication of the selected information."),
        headshot: compact({
          contact: r.text("headshot-contact"),
          paidSession: r.consent("headshot-paid-session", "I understand a paid session with the official photographer is mandatory."),
          officialOnly: r.consent("headshot-official-only", "I understand I cannot provide my own headshot."),
          photoConsent: r.consent("headshot-photo-consent", "I authorize photography and publication of the selected image."),
          extraFees: r.consent("headshot-extra-fees", "I understand additional deliverables may require an additional fee."),
          placementNotGuaranteed: r.consent("headshot-placement", "I understand payment does not guarantee permanent directory placement."),
        }),
      })
    : { choice: directoryChoice === "info" ? "info" : "no" };

  const partnerChoice = r.text("partner");
  const partner: ApplicationAnswers["partner"] = partnerChoice === "yes" || partnerChoice === "maybe"
    ? { choice: partnerChoice, interest: r.required("partner-interest", "Describe your interest") }
    : { choice: "no" };

  const newsletter: ApplicationAnswers["newsletter"] = r.text("newsletter") === "yes"
    ? { subscribe: true, emailConsent: r.consent("newsletter-consent", "I consent to receive collective email and understand I can unsubscribe at any time.") }
    : { subscribe: false };

  const accepted = form.getAll("guidelines");
  if (!GUIDELINES.every((g) => accepted.includes(g))) throw new Error("Please confirm each community guideline.");

  const answers: ApplicationAnswers = compact({
    preferredName: r.text("preferred-name"),
    pronouns: r.text("pronouns"),
    phone: r.required("phone", "Phone number"),
    basedIn,
    connection: r.requiredList("connection", "What is your connection to Western Queens?"),
    business: r.text("business"),
    role: r.required("role", "Professional title or role"),
    website: r.text("website"),
    instagram: r.text("instagram"),
    linkedin: r.text("linkedin"),
    otherProfile: r.text("social"),
    story: r.required("story", "Tell us about yourself and your work"),
    industry,
    otherIndustry: industry.includes("Other") ? r.required("other-industry", "Describe your industry") : undefined,
    communityGoals: r.requiredList("community-goals", "What are you hoping to find through the collective?"),
    idealReferral: r.required("ideal-referral", "Your ideal referral or connection"),
    communitySupport: r.text("community-support"),
    memberSupport: r.requiredList("member-support", "How would you like to support other members?"),
    coffee: r.text("coffee"),
    contactPreference: r.list("contact-preference"),
    localShoutout: r.text("local-shoutout"),
    whatsapp,
    spotlight,
    directory,
    events: r.list("events"),
    partner,
    newsletter,
    applicationContact: r.text("application-contact"),
    communityGuidelines: true,
    heardAbout: r.text("heard"),
    referrer: r.text("referrer"),
    signature: r.required("signature", "Electronic signature"),
    date: r.required("date", "Date"),
    finalConfirmation: r.consent("final-confirmation", "I have read and agreed to the permissions, statements, and community guidelines in this application."),
  });

  if (new TextEncoder().encode(JSON.stringify(answers)).length > LIMITS.answersBytes) {
    throw new Error("Your answers are a little too long to send. Please shorten your longest answers and try again.");
  }

  return { email, fullName, neighborhood, answers };
}
