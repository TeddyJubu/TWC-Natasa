import * as React from "react";
import { Icon } from "@/app/layout/twc";
import { GUIDELINES, LIMITS, TYPED_LOCATIONS, parseApplication, type ApplicationInput } from "./schema";
import { Check, Choices, Field, Input, LongAnswer, Notice, Section, Select } from "./twc-fields";

const yesNo = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];
const locationOptions = ["Long Island City", "Astoria", "Sunnyside", "Woodside", "Jackson Heights", "Elmhurst", "East Elmhurst", "Forest Hills", "Rego Park", "Another Queens neighborhood", "Brooklyn", "Manhattan", "Other"];
const connectionOptions = ["I live here", "I work here", "I own a business here", "I have clients here", "I regularly participate in the local community", "Other"];
const industryOptions = ["Arts and culture", "Beauty and wellness", "Coaching and consulting", "Design and interiors", "Education", "Finance and legal", "Food and hospitality", "Health and fitness", "Marketing and media", "Mental health and healing", "Nonprofit and community work", "Parenting and family services", "Real estate", "Retail and products", "Technology", "Travel", "Writing and publishing", "Other"];
const communityOptions = ["Professional connections", "Friendship and community", "Referrals", "Collaborators", "Clients", "Mentorship", "Education", "Local events", "Speaking opportunities", "Vendor opportunities", "Community resources", "Business visibility"];
const supportOptions = ["Give referrals", "Make introductions", "Share knowledge", "Mentor", "Collaborate", "Host an event", "Sponsor an event", "Offer a member benefit", "Volunteer", "Other"];
const directoryOptions = ["Full name", "Professional title", "Business name", "Business description", "Neighborhood", "Website", "Instagram", "LinkedIn", "Public email", "Public business phone", "Business logo"];
const eventOptions = ["Attend events", "Speak or teach", "Host an event", "Offer a venue", "Sponsor an event", "Provide products or services", "Volunteer"];
const heardOptions = ["A current member", "An event", "Social media", "Newsletter", "Search", "Word of mouth", "Other"];

/** Conditional follow-up questions sit in a tinted panel under the answer that opened them. */
const followUp = "motion-panel-in flex flex-col gap-5 rounded-[6px] bg-sb-cream p-5 sm:p-6";

export interface ApplicationFormProps {
  /** Sends the parsed application; reject to show the inline error with Retry. */
  submit: (application: ApplicationInput) => Promise<void>;
  /** Prefills name and email (e.g. for a signed-in applicant) without overwriting anything already typed. */
  initial?: { fullName?: string; email?: string };
  /** Offer "Review another application" after success (showcase demo only). */
  resettable?: boolean;
  /** A suggested next step shown in the success state (e.g. a link to create a login). */
  nextStep?: React.ReactNode;
}

/** Name of the hidden anti-spam field; deliberately not a real application field. */
const HONEYPOT = "fax-number";

/** `invalid`: the parser rejected the answers (clears on the next edit). `send`: the insert failed (offers Retry). */
type Failure = { kind: "invalid" | "send"; message: string };

export function ApplicationForm({ submit, initial, resettable, nextStep }: ApplicationFormProps) {
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent">("idle");
  const [failure, setFailure] = React.useState<Failure | null>(null);
  const [round, setRound] = React.useState(0);
  // A ref, not state: a second submit can arrive before the "sending" render lands.
  const inFlight = React.useRef(false);

  // Submit and Retry both land here, so every attempt re-reads the current answers and re-runs validation.
  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    // Honeypot: only bots fill the hidden field. They get the normal success state and nothing is saved.
    if (new FormData(event.currentTarget).get(HONEYPOT)) return setStatus("sent");
    let application: ApplicationInput;
    try {
      application = parseApplication(new FormData(event.currentTarget));
    } catch (error) {
      setFailure({ kind: "invalid", message: error instanceof Error ? error.message : "Please check your answers and try again." });
      return;
    }
    inFlight.current = true;
    setStatus("sending");
    // Keep a send failure (and its Retry button, which may hold focus) on screen while retrying.
    setFailure((current) => (current?.kind === "send" ? current : null));
    try {
      await submit(application);
      setStatus("sent");
    } catch {
      setFailure({ kind: "send", message: "We couldn’t send your application. Your answers are still here, so please try again." });
      setStatus("idle");
    } finally {
      inFlight.current = false;
    }
  };

  const onEdit = () => setFailure((current) => (current?.kind === "invalid" ? null : current));

  if (status === "sent") return <Received nextStep={nextStep} onReset={resettable ? () => { setRound((r) => r + 1); setStatus("idle"); } : undefined} />;

  return (
    <ApplicationFields
      key={round}
      initial={initial}
      busy={status === "sending"}
      failure={failure}
      onSubmit={(event) => void onSubmit(event)}
      onEdit={onEdit}
    />
  );
}

function Received({ nextStep, onReset }: { nextStep?: React.ReactNode; onReset?: () => void }) {
  const panel = React.useRef<HTMLDivElement>(null);
  // The long form is gone, so move focus to the confirmation instead of leaving it on a removed button.
  React.useEffect(() => panel.current?.focus(), []);
  return (
    <div ref={panel} tabIndex={-1} role="status" className="motion-panel-in scroll-mt-28 flex flex-col items-center gap-4 rounded-[6px] bg-sb-sun px-6 py-16 text-center outline-none sm:px-8">
      <span className="twc-ticket__meta">Application received</span>
      <p aria-hidden className="inline-flex items-center gap-2 font-script text-[36px] leading-[1.1]">thank you <Icon name="sparkle" className="size-6" /></p>
      <h2 className="twc-h3">Thank you for introducing yourself.</h2>
      <p className="max-w-[520px] text-[17px]">We are excited to learn more about you and your work. Your application will be reviewed, and we will contact you if we need anything else.</p>
      {nextStep}
      {onReset && <button type="button" className="twc-btn mt-2" onClick={onReset}>Review another application</button>}
    </div>
  );
}

interface FieldsProps {
  initial?: ApplicationFormProps["initial"];
  busy: boolean;
  failure: Failure | null;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onEdit: () => void;
}

function ApplicationFields({ initial, busy, failure, onSubmit, onEdit }: FieldsProps) {
  const [location, setLocation] = React.useState("");
  const [industry, setIndustry] = React.useState<string[]>([]);
  const [whatsApp, setWhatsApp] = React.useState("no");
  const [spotlight, setSpotlight] = React.useState("no");
  const [directory, setDirectory] = React.useState("no");
  const [newsletter, setNewsletter] = React.useState("yes");
  const [partner, setPartner] = React.useState("no");

  // Prefill arrives asynchronously; fill only fields that are still empty so nothing typed is overwritten.
  const nameInput = React.useRef<HTMLInputElement>(null);
  const emailInput = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (initial?.fullName && nameInput.current && !nameInput.current.value) nameInput.current.value = initial.fullName;
  }, [initial?.fullName]);
  React.useEffect(() => {
    if (initial?.email && emailInput.current && !emailInput.current.value) emailInput.current.value = initial.email;
  }, [initial?.email]);

  // The message sits at the end of a long form, so move focus to it whenever a new one appears.
  const alert = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (failure) alert.current?.focus();
  }, [failure]);

  // aria-disabled rather than disabled while sending: a disabled button would drop keyboard focus.
  const pending = { "aria-disabled": busy || undefined, className: "aria-disabled:cursor-progress" };

  return (
    <form className="rounded-[6px] bg-sb-paper p-5 shadow-[inset_0_0_0_1px_rgb(31_31_28/0.15)] sm:p-12" onSubmit={onSubmit} onChange={onEdit} aria-busy={busy}>
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Leave this field empty<input name={HONEYPOT} type="text" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="flex flex-col gap-12">
        <Section index="01 — Personal information" title="Start with you." description="Private details stay private unless you explicitly authorize publication.">
          <div className="grid gap-[22px] sm:grid-cols-2">
            <Field id="full-name" label="Full name"><Input ref={nameInput} name="full-name" autoComplete="name" maxLength={LIMITS.fullName} required /></Field>
            <Field id="preferred-name" label="Preferred name" optional><Input name="preferred-name" /></Field>
            <Field id="pronouns" label="Pronouns" optional><Input name="pronouns" /></Field>
            <Field id="email" label="Email address"><Input ref={emailInput} name="email" type="email" autoComplete="email" maxLength={254} required /></Field>
            <Field id="phone" label="Phone number"><Input name="phone" type="tel" autoComplete="tel" required /></Field>
            <Field id="neighborhood" label="Where are you based?"><Select name="neighborhood" required value={location} onChange={(event) => setLocation(event.currentTarget.value)}><option value="">Choose a neighborhood</option>{locationOptions.map((item) => <option key={item}>{item}</option>)}</Select></Field>
            {TYPED_LOCATIONS.includes(location) && <Field id="other-location" label="Tell us where you are based"><Input name="other-location" maxLength={LIMITS.neighborhood} required /></Field>}
          </div>
          <Choices name="connection" legend="What is your connection to Western Queens?" hint="Select all that apply." options={connectionOptions} required />
        </Section>

        <Section index="02 — About your work" title="Share what you do." description="Help members understand your work in your own words.">
          <div className="grid gap-[22px] sm:grid-cols-2">
            <Field id="business" label="Business or organization name" optional><Input name="business" /></Field>
            <Field id="role" label="Professional title or role"><Input name="role" required /></Field>
            <Field id="website" label="Business website" optional><Input name="website" type="url" /></Field>
            <Field id="instagram" label="Instagram" optional><Input name="instagram" /></Field>
            <Field id="linkedin" label="LinkedIn" optional><Input name="linkedin" type="url" /></Field>
            <Field id="social" label="Other social or professional profile" optional><Input name="social" type="url" /></Field>
          </div>
          <Field id="story" label="Tell us about yourself and your work"><LongAnswer name="story" rows={4} required /></Field>
          <Choices name="industry" legend="Industry" hint="Select all that apply." options={industryOptions} required onValueChange={setIndustry} />
          {industry.includes("Other") && <div className={followUp}><Field id="other-industry" label="Describe your industry"><Input name="other-industry" required /></Field></div>}
        </Section>

        <Section index="03 — Community connections" title="Find your people." description="Tell us what meaningful support looks like for you.">
          <Choices name="community-goals" legend="What are you hoping to find through the collective?" options={communityOptions} required />
          <div className="grid gap-[22px] sm:grid-cols-2">
            <Field id="ideal-referral" label="Your ideal referral or connection"><LongAnswer name="ideal-referral" required /></Field>
            <Field id="community-support" label="How can the community support you?" optional><LongAnswer name="community-support" /></Field>
          </div>
          <Choices name="member-support" legend="How would you like to support other members?" options={supportOptions} required />
          <Choices type="radio" name="coffee" legend="Are you open to one-to-one meetings or coffee chats?" optional options={["Yes — in person", "Yes — virtually", "Yes — either", "Not at this time"]} />
          <Choices name="contact-preference" legend="How do you prefer members to contact you?" optional options={["Email", "Phone", "Text", "WhatsApp", "Instagram", "LinkedIn"]} />
          <Field id="local-shoutout" label="Shout out a local business, organization, or resource you love" optional><LongAnswer name="local-shoutout" /></Field>
        </Section>

        <Section index="04 — WhatsApp community" title="Join the conversation." description="Your number will be visible to other group members.">
          <Choices type="radio" name="whatsapp" legend="Would you like to join the WhatsApp community?" defaultValue="no" onValueChange={([value]) => setWhatsApp(value)} options={yesNo} />
          {whatsApp === "yes" && (
            <div className={`${followUp} bg-sb-mint`}>
              <Field id="whatsapp-number" label="WhatsApp phone number"><Input name="whatsapp-number" type="tel" required /></Field>
              <Check name="whatsapp-visibility" label="I understand my phone number will be visible to group members." required />
              <Check name="whatsapp-conduct" label="I will keep the space respectful and free from spam or harassment." required />
            </div>
          )}
        </Section>

        <Section index="05 — Member spotlight" title="Let your work shine." description="Spotlights are optional and published only with permission.">
          <Choices type="radio" name="spotlight" legend="Would you like to be considered for a member spotlight?" defaultValue="no" onValueChange={([value]) => setSpotlight(value)} options={[...yesNo, "Please contact me first"]} />
          {spotlight === "yes" && (
            <div className={followUp}>
              <Field id="spotlight-focus" label="What would you most like us to highlight?"><LongAnswer name="spotlight-focus" required /></Field>
              <Check name="spotlight-consent" label="I authorize The Women’s Collective to edit and publish my submitted biography, business information, links, logo, and approved photographs for a member spotlight." required />
            </div>
          )}
        </Section>

        <Section index="06 — Public member directory" title="Shape your listing." description="Directory participation is optional and subject to review and approval. If you are approved, we will ask for your business logo then.">
          <Choices type="radio" name="directory" legend="Would you like to apply for the public member directory?" defaultValue="no" onValueChange={([value]) => setDirectory(value)} options={[{ value: "yes", label: "Yes — apply" }, { value: "no", label: "No — keep my information private" }, { value: "info", label: "Send me more information first" }]} />
          {directory === "yes" && (
            <div className={followUp}>
              <Choices name="public-fields" legend="Which information may be displayed publicly?" optional options={directoryOptions} />
              <div className="grid gap-[22px] sm:grid-cols-2">
                <Field id="directory-email" label="Public directory email" optional><Input name="directory-email" type="email" /></Field>
                <Field id="directory-phone" label="Public directory phone" optional><Input name="directory-phone" type="tel" /></Field>
              </div>
              <Field id="directory-bio" label="Directory biography" hint="Write 50–100 words in the third person."><LongAnswer name="directory-bio" required /></Field>
              <Field id="services" label="Services or specialties" hint="List up to five."><Input name="services" required /></Field>
              <Check name="directory-consent" label="I authorize publication of the selected information on The Women’s Collective website." required />
            </div>
          )}
        </Section>

        {directory === "yes" && (
          <Section index="07 — Official headshot" title="A consistent collective portrait." description="Required only for approved public directory members.">
            <Notice tone="mint" eyebrow="Good to know" title="A paid official session is required">
              <p>Approved directory applicants attend a professional headshot session with the collective’s official photographer. Personal or previously taken headshots cannot be used. Price, dates, location, payment instructions, and booking details are shared before scheduling.</p>
              <p>A profile is not published until the application is approved and the session is booked, paid for, and completed.</p>
            </Notice>
            <Choices type="radio" name="headshot-contact" legend="How should we contact you to schedule your headshot?" optional options={["Email", "Phone", "Text", "WhatsApp"]} />
            <div className="flex flex-col gap-4">
              <Check name="headshot-paid-session" label="I understand that a paid session with the official photographer is mandatory for the public directory." required />
              <Check name="headshot-official-only" label="I understand I cannot provide my own headshot and my profile will wait until the official session is paid for and completed." required />
              <Check name="headshot-photo-consent" label="I authorize photography and the cropping, resizing, light retouching, and publication of the selected image across collective channels." required />
              <Check name="headshot-extra-fees" label="I understand additional photographs, advanced retouching, prints, or other deliverables may require an additional fee." required />
              <Check name="headshot-placement" label="I understand payment does not guarantee permanent directory placement, which remains subject to approval and community guidelines." required />
            </div>
          </Section>
        )}

        <Section index="08 — Events and partnerships" title="Take part your way." description="Attend, contribute, host, or collaborate.">
          <Choices name="events" legend="How would you like to participate in events?" optional options={eventOptions} />
          <Choices type="radio" name="partner" legend="Would you like to become a sponsor or community partner?" defaultValue="no" onValueChange={([value]) => setPartner(value)} options={[yesNo[0], { value: "maybe", label: "Maybe" }, yesNo[1]]} />
          {partner !== "no" && <div className={followUp}><Field id="partner-interest" label="Describe your interest"><LongAnswer name="partner-interest" required /></Field></div>}
        </Section>

        <Section index="09 — Communication" title="Stay in the loop." description="Choose what reaches your inbox.">
          <Choices type="radio" name="newsletter" legend="Receive news, event invitations, opportunities, and updates?" defaultValue="yes" onValueChange={([value]) => setNewsletter(value)} options={yesNo} />
          {newsletter === "yes" && <Check name="newsletter-consent" label="I consent to receive collective email and understand I can unsubscribe at any time." required />}
          <Choices type="radio" name="application-contact" legend="May we contact you directly about your application?" optional options={["Email", "Phone", "Text", "WhatsApp", "Any of these"]} />
        </Section>

        <Section index="10 — Community guidelines" title="Keep it generous." description="Confirm each commitment before submitting.">
          {/* Every guideline is its own required commitment. */}
          <fieldset className="min-w-0">
            <legend className="twc-label mb-4">Community guidelines</legend>
            <div className="flex flex-col gap-4">{GUIDELINES.map((guideline) => <Check key={guideline} name="guidelines" value={guideline} label={guideline} required />)}</div>
          </fieldset>
          <Notice title="Privacy and membership">
            <p>We use submitted information to review applications, communicate with applicants, manage community programs and events, schedule official headshot sessions, and—with permission—create directory listings and spotlights.</p>
            <p>Private information is not intentionally published. Information you choose to share in member groups or at events may be visible to other participants. The collective may moderate spaces and decline or remove participation when needed to protect the community.</p>
          </Notice>
        </Section>

        <Section index="11 — Final confirmation" title="Make it official." description="One final review, then send.">
          <div className="grid gap-[22px] sm:grid-cols-2">
            <Field id="heard" label="How did you hear about us?" optional><Select name="heard" defaultValue=""><option value="">Choose one</option>{heardOptions.map((item) => <option key={item}>{item}</option>)}</Select></Field>
            <Field id="referrer" label="Name of the member who referred you" optional><Input name="referrer" /></Field>
            <Field id="signature" label="Electronic signature" hint="Type your full name to sign."><Input name="signature" required /></Field>
            <Field id="date" label="Date"><Input name="date" type="date" required /></Field>
          </div>
          <Check name="final-confirmation" className="rounded-[6px] bg-sb-cream p-[18px]" label="By submitting, I confirm that I have read, understood, and agreed to the permissions, statements, and community guidelines in this application." required />
          {failure && (
            <Notice ref={alert} tabIndex={-1} role="alert" tone="danger" title={failure.kind === "send" ? "We couldn’t send that yet" : "One more thing"} className="scroll-mt-28 outline-none">
              <p>{failure.message}</p>
              {/* A second submit button: Retry re-reads and re-validates the form as it is now. */}
              {failure.kind === "send" && <button type="submit" {...pending} className={`twc-btn twc-btn--sm self-start ${pending.className}`}>Retry</button>}
            </Notice>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" {...pending} className={`twc-btn ${pending.className}`}>Submit application <Icon name="arrow" className="twc-arrow" /></button>
            <p className="max-w-md text-[13px] leading-relaxed text-sb-muted">Leaving an optional question unanswered never counts as permission.</p>
          </div>
        </Section>
      </div>
    </form>
  );
}
