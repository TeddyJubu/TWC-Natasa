// The /join application: the typed shape stored in `applications.answers`, and the FormData parser that
// builds it. Native validation runs first in the browser; this re-checks every requirement (defence in depth).

/** The six community guidelines. Each is a separate commitment and every one must be accepted. */
export const GUIDELINES = [
  "I will treat members with respect and professionalism.",
  "I will not use the community for spam, aggressive sales, or mass messaging.",
  "I will protect other members’ personal and business information.",
  "I understand the community is for genuine relationships, local connection, and collaboration.",
  "I understand membership is subject to review.",
  "I confirm that this application is accurate and I may represent the business listed.",
] as const;

/** The page's answer choices (shared with the admin's copy of this form, `built-in-copies.ts`). */
export const locationOptions = ["Greenpoint", "Williamsburg", "Bushwick"];
export const queensOptions = ["Long Island City", "Astoria", "Sunnyside", "Woodside", "Jackson Heights", "Elmhurst", "East Elmhurst", "Forest Hills", "Rego Park"];
/**
 * One shared form with a link per area (user decision, 2026-11-22): each link has its own question. Applicants type their
 * neighborhood; `neighborhoods` are only the names we recognize, so Spotlight can name a member's area.
 */
export type Area = { id: string; name: string; borough: string; href: string; neighborhoods: readonly string[]; connection: string };
export const AREAS: readonly Area[] = [
  { id: "north-brooklyn", name: "North Brooklyn", borough: "Brooklyn", href: "/join?area=north-brooklyn", neighborhoods: locationOptions, connection: "What is your connection to North Brooklyn?" },
  { id: "queens", name: "Queens", borough: "Queens", href: "/join?area=queens", neighborhoods: queensOptions, connection: "What is your connection to Queens?" },
];
/** The area a link names, or undefined: plain /join then asks, rather than assuming one. */
export const areaById = (id: unknown): Area | undefined => AREAS.find((a) => a.id === id);
/** The area a neighborhood is in, or undefined for one on neither list, so its wording stays neutral. */
export function areaOfPlace(place: string | null | undefined): Area | undefined {
  const name = place?.trim().toLowerCase();
  return name ? AREAS.find((a) => a.neighborhoods.some((n) => n.toLowerCase() === name)) : undefined;
}
export const connectionOptions = ["I live here", "I work here", "I own a business here", "I have clients here", "I regularly participate in the local community", "Other"];
export const industryOptions = ["Arts and culture", "Beauty and wellness", "Coaching and consulting", "Design and interiors", "Education", "Finance and legal", "Food and hospitality", "Health and fitness", "Marketing and media", "Mental health and healing", "Nonprofit and community work", "Parenting and family services", "Real estate", "Retail and products", "Technology", "Travel", "Writing and publishing", "Other"];
export const communityOptions = ["Professional connections", "Friendship and community", "Referrals", "Collaborators", "Clients", "Mentorship", "Education", "Local events", "Speaking opportunities", "Vendor opportunities", "Community resources", "Business visibility"];
export const supportOptions = ["Give referrals", "Make introductions", "Share knowledge", "Mentor", "Collaborate", "Host an event", "Sponsor an event", "Offer a member benefit", "Volunteer", "Other"];
export const eventOptions = ["Attend events", "Speak or teach", "Host an event", "Offer a venue", "Sponsor an event", "Provide products or services", "Volunteer"];
export const heardOptions = ["A current member", "An event", "Social media", "Newsletter", "Search", "Word of mouth", "Other"];

/** Mirrors the `applications` table checks in migration 0001; `answersBytes` keeps a margin under the 32 KB jsonb check. */
export const LIMITS = { fullName: 120, email: 254, neighborhood: 60, text: 2000, answersBytes: 30 * 1024 } as const;
/** The `applications.email` check in migration 0001. */
export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const DAY_MS = 24 * 60 * 60 * 1000;
export const DATE_ERROR = "Please enter today’s date.";
/** The signing date: a real calendar day, at most a year old, and no later than tomorrow in UTC (time zones run ahead). */
export function isSigningDate(value: unknown, now = Date.now()): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value && time <= now + DAY_MS && time >= now - 366 * DAY_MS;
}

export interface ApplicationAnswers {
  preferredName?: string;
  pronouns?: string;
  phone: string;
  /** What she typed under "Where are you based?"; also the application's `neighborhood`. */
  basedIn: string;
  /** Which area's link she applied through. Absent on applications from before areas. */
  area?: string;
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
  // The WhatsApp community, spotlight, directory and headshot questions are no longer asked (owner decision, 2026-11-24).
  // Applications sent before then keep these answers as stored, and admins still read them.
  whatsapp?: { join: false } | { join: true; number: string; numberVisible: true; keepRespectful: true };
  spotlight?: { choice: "no" | "Please contact me first" } | { choice: "yes"; focus: string; publicationConsent: true };
  directory?:
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
          officialOnly: true;
          photoConsent: true;
          placementNotGuaranteed: true;
          /** Only on applications sent before 2026-11-23. */
          paidSession?: true;
          extraFees?: true;
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
  const area = areaById(r.text("area"));
  if (!area) throw new Error("Please choose your area: North Brooklyn or Queens.");
  const neighborhood = r.required("neighborhood", "Where are you based?");
  if (neighborhood.length > LIMITS.neighborhood) throw new Error(`Please keep your location under ${LIMITS.neighborhood} characters.`);

  const industry = r.requiredList("industry", "Industry");

  const partnerChoice = r.text("partner");
  const partner: ApplicationAnswers["partner"] = partnerChoice === "yes" || partnerChoice === "maybe"
    ? { choice: partnerChoice, interest: r.required("partner-interest", "Describe your interest") }
    : { choice: "no" };

  const newsletter: ApplicationAnswers["newsletter"] = r.text("newsletter") === "yes"
    ? { subscribe: true, emailConsent: r.consent("newsletter-consent", "I consent to receive collective email and understand I can unsubscribe at any time.") }
    : { subscribe: false };

  const accepted = form.getAll("guidelines");
  if (!GUIDELINES.every((g) => accepted.includes(g))) throw new Error("Please confirm each community guideline.");

  const date = r.required("date", "Date");
  if (!isSigningDate(date)) throw new Error(DATE_ERROR);

  const answers: ApplicationAnswers = compact({
    preferredName: r.text("preferred-name"),
    pronouns: r.text("pronouns"),
    phone: r.required("phone", "Phone number"),
    basedIn: neighborhood,
    area: area.name,
    connection: r.requiredList("connection", area.connection),
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
    events: r.list("events"),
    partner,
    newsletter,
    applicationContact: r.text("application-contact"),
    communityGuidelines: true,
    heardAbout: r.text("heard"),
    referrer: r.text("referrer"),
    signature: r.required("signature", "Electronic signature"),
    date,
    finalConfirmation: r.consent("final-confirmation", "I have read and agreed to the permissions, statements, and community guidelines in this application."),
  });

  if (new TextEncoder().encode(JSON.stringify(answers)).length > LIMITS.answersBytes) {
    throw new Error("Your answers are a little too long to send. Please shorten your longest answers and try again.");
  }

  return { email, fullName, neighborhood, answers };
}
