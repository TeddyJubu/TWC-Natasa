import * as React from "react";
import {
  BrandLockup, Button, Checkbox, ChoiceGroup, FormActions, FormField, FormNotice, FormProgress,
  FormSection, Heading, Input, RadioGroup, Select, Text, Textarea,
} from "@/index";
import { GUIDELINES, LIMITS, TYPED_LOCATIONS, parseApplication, type ApplicationInput } from "./schema";

const progress = ["About", "Work", "Community", "WhatsApp", "Spotlight", "Directory", "Headshot", "Events", "Contact", "Guidelines", "Finish"];
const choices = (labels: string[]) => labels.map((label) => ({ value: label, label }));
const locationOptions = ["Long Island City", "Astoria", "Sunnyside", "Woodside", "Jackson Heights", "Elmhurst", "East Elmhurst", "Forest Hills", "Rego Park", "Another Queens neighborhood", "Brooklyn", "Manhattan", "Other"];
const connectionOptions = choices(["I live here", "I work here", "I own a business here", "I have clients here", "I regularly participate in the local community", "Other"]);
const industryOptions = choices(["Arts and culture", "Beauty and wellness", "Coaching and consulting", "Design and interiors", "Education", "Finance and legal", "Food and hospitality", "Health and fitness", "Marketing and media", "Mental health and healing", "Nonprofit and community work", "Parenting and family services", "Real estate", "Retail and products", "Technology", "Travel", "Writing and publishing", "Other"]);
const communityOptions = choices(["Professional connections", "Friendship and community", "Referrals", "Collaborators", "Clients", "Mentorship", "Education", "Local events", "Speaking opportunities", "Vendor opportunities", "Community resources", "Business visibility"]);
const supportOptions = choices(["Give referrals", "Make introductions", "Share knowledge", "Mentor", "Collaborate", "Host an event", "Sponsor an event", "Offer a member benefit", "Volunteer", "Other"]);
const directoryOptions = choices(["Full name", "Professional title", "Business name", "Business description", "Neighborhood", "Website", "Instagram", "LinkedIn", "Public email", "Public business phone", "Business logo"]);
const eventOptions = choices(["Attend events", "Speak or teach", "Host an event", "Offer a venue", "Sponsor an event", "Provide products or services", "Volunteer"]);
const heardOptions = ["A current member", "An event", "Social media", "Newsletter", "Search", "Word of mouth", "Other"];

function Field({ id, label, optional, hint, children }: { id: string; label: string; optional?: boolean; hint?: string; children: React.ReactNode }) {
  return <FormField htmlFor={id} label={label} optional={optional} hint={hint}>{children}</FormField>;
}

/** Long answers stay well inside the 32 KB `answers` column. */
function LongAnswer(props: React.ComponentProps<typeof Textarea>) {
  return <Textarea maxLength={LIMITS.text} {...props} />;
}

export interface ApplicationFormProps {
  /** Sends the parsed application; reject to show the inline error with Retry. */
  submit: (application: ApplicationInput) => Promise<void>;
  /** Prefills name and email (e.g. for a signed-in applicant) without overwriting anything already typed. */
  initial?: { fullName?: string; email?: string };
  /** Offer "Review another application" after success (showcase demo only). */
  resettable?: boolean;
}

/** Name of the hidden anti-spam field; deliberately not a real application field. */
const HONEYPOT = "fax-number";

/** `invalid`: the parser rejected the answers (clears on the next edit). `send`: the insert failed (offers Retry). */
type Failure = { kind: "invalid" | "send"; message: string };

export function ApplicationForm({ submit, initial, resettable }: ApplicationFormProps) {
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

  if (status === "sent") return <Received onReset={resettable ? () => { setRound((r) => r + 1); setStatus("idle"); } : undefined} />;

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

function Received({ onReset }: { onReset?: () => void }) {
  const panel = React.useRef<HTMLDivElement>(null);
  // The long form is gone, so move focus to the confirmation instead of leaving it on a removed button.
  React.useEffect(() => panel.current?.focus(), []);
  return (
    <div ref={panel} tabIndex={-1} className="motion-panel-in grid min-h-[32rem] place-items-center bg-mint p-8 text-center outline-none md:p-16" role="status">
      <div className="max-w-xl">
        <span className="font-sans text-xs font-medium uppercase text-ink-muted">Application received</span>
        <Heading className="mt-5">Thank You for Introducing Yourself</Heading>
        <Text className="mt-5">We are excited to learn more about you and your work. Your application will be reviewed, and we will contact you if we need anything else.</Text>
        {onReset && <Button variant="ink" className="mt-8" onClick={onReset}>Review another application</Button>}
      </div>
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
  const pending = { "aria-disabled": busy || undefined, className: "aria-disabled:cursor-progress aria-disabled:opacity-45" };

  return (
    <form className="tone-light mx-auto w-full max-w-4xl bg-canvas" onSubmit={onSubmit} onChange={onEdit} aria-busy={busy}>
      <header className="motion-stagger border-b border-line bg-paper px-6 py-12 md:px-12 md:py-16">
        <div className="flex items-center justify-between gap-5"><BrandLockup /><span className="rounded-full border border-line px-3 py-1 font-sans text-xs uppercase">New members</span></div>
        <p className="mt-16 font-sans text-xs font-medium uppercase text-ink-muted">Membership application</p>
        <Heading as="h1" size="display" className="mt-4 max-w-3xl text-[3.25rem] leading-[1.03] sm:text-6xl md:text-[5.25rem]">Tell Us About Your Place in the Constellation</Heading>
        <Text className="mt-5 max-w-xl">Complete this application so we can learn about you, your work, and how you would like to participate in The Women’s Collective.</Text>
        <FormProgress items={progress} current={0} className="mt-12" />
      </header>

      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Leave this field empty<input name={HONEYPOT} type="text" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="space-y-20 px-6 py-12 md:px-12 md:py-16">
        <FormSection headingAs="h2" index="01 — Personal information" title="Start With You" description="Private details stay private unless you explicitly authorize publication.">
          <div className="grid gap-8 md:grid-cols-2">
            <Field id="full-name" label="Full name"><Input ref={nameInput} name="full-name" autoComplete="name" maxLength={LIMITS.fullName} required /></Field>
            <Field id="preferred-name" label="Preferred name" optional><Input name="preferred-name" /></Field>
            <Field id="pronouns" label="Pronouns" optional><Input name="pronouns" /></Field>
            <Field id="email" label="Email address"><Input ref={emailInput} name="email" type="email" autoComplete="email" maxLength={254} required /></Field>
            <Field id="phone" label="Phone number"><Input name="phone" type="tel" autoComplete="tel" required /></Field>
            <Field id="neighborhood" label="Where are you based?"><Select name="neighborhood" required value={location} onChange={(event) => setLocation(event.currentTarget.value)}><option value="">Choose a neighborhood</option>{locationOptions.map((item) => <option key={item}>{item}</option>)}</Select></Field>
            {TYPED_LOCATIONS.includes(location) && <Field id="other-location" label="Tell us where you are based"><Input name="other-location" maxLength={LIMITS.neighborhood} required /></Field>}
            <ChoiceGroup className="md:col-span-2" name="connection" legend="What is your connection to Western Queens?" hint="Select all that apply." options={connectionOptions} required />
          </div>
        </FormSection>

        <FormSection headingAs="h2" index="02 — About your work" title="Share What You Do" description="Help members understand your work in your own words.">
          <div className="grid gap-8 md:grid-cols-2">
            <Field id="business" label="Business or organization name" optional><Input name="business" /></Field>
            <Field id="role" label="Professional title or role"><Input name="role" required /></Field>
            <Field id="website" label="Business website" optional><Input name="website" type="url" /></Field>
            <Field id="instagram" label="Instagram" optional><Input name="instagram" /></Field>
            <Field id="story" label="Tell us about yourself and your work"><LongAnswer name="story" required /></Field>
            <div className="grid gap-8"><Field id="linkedin" label="LinkedIn" optional><Input name="linkedin" type="url" /></Field><Field id="social" label="Other social or professional profile" optional><Input name="social" type="url" /></Field></div>
            <ChoiceGroup className="md:col-span-2" name="industry" legend="Industry" hint="Select all that apply." options={industryOptions} columns={3} required onValueChange={setIndustry} />
            {industry.includes("Other") && <Field id="other-industry" label="Describe your industry"><Input name="other-industry" required /></Field>}
          </div>
        </FormSection>

        <FormSection headingAs="h2" index="03 — Community connections" title="Find Your People" description="Tell us what meaningful support looks like for you.">
          <div className="grid gap-8">
            <ChoiceGroup name="community-goals" legend="What are you hoping to find through the collective?" options={communityOptions} columns={2} required />
            <div className="grid gap-8 md:grid-cols-2"><Field id="ideal-referral" label="Your ideal referral or connection"><LongAnswer name="ideal-referral" required /></Field><Field id="community-support" label="How can the community support you?" optional><LongAnswer name="community-support" /></Field></div>
            <ChoiceGroup name="member-support" legend="How would you like to support other members?" options={supportOptions} required />
            <RadioGroup name="coffee" legend="Are you open to one-to-one meetings or coffee chats?" options={choices(["Yes — in person", "Yes — virtually", "Yes — either", "Not at this time"])} />
            <ChoiceGroup name="contact-preference" legend="How do you prefer members to contact you?" options={choices(["Email", "Phone", "Text", "WhatsApp", "Instagram", "LinkedIn"])} columns={3} />
            <Field id="local-shoutout" label="Shout out a local business, organization, or resource you love" optional><LongAnswer name="local-shoutout" /></Field>
          </div>
        </FormSection>

        <FormSection headingAs="h2" index="04 — WhatsApp community" title="Join the Conversation" description="Your number will be visible to other group members.">
          <div className="grid gap-8">
            <RadioGroup name="whatsapp" legend="Would you like to join the WhatsApp community?" defaultValue="no" onValueChange={setWhatsApp} options={choices(["yes", "no"])} />
            {whatsApp === "yes" && <div className="motion-panel-in grid gap-6 rounded-card bg-mint p-6"><Field id="whatsapp-number" label="WhatsApp phone number"><Input name="whatsapp-number" type="tel" required /></Field><Checkbox name="whatsapp-visibility" label="I understand my phone number will be visible to group members." required /><Checkbox name="whatsapp-conduct" label="I will keep the space respectful and free from spam or harassment." required /></div>}
          </div>
        </FormSection>

        <FormSection headingAs="h2" index="05 — Member spotlight" title="Let Your Work Shine" description="Spotlights are optional and published only with permission.">
          <div className="grid gap-8">
            <RadioGroup name="spotlight" legend="Would you like to be considered for a member spotlight?" defaultValue="no" onValueChange={setSpotlight} options={choices(["yes", "no", "Please contact me first"])} />
            {spotlight === "yes" && <div className="motion-panel-in grid gap-6"><Field id="spotlight-focus" label="What would you most like us to highlight?"><LongAnswer name="spotlight-focus" required /></Field><Checkbox name="spotlight-consent" label="I authorize The Women’s Collective to edit and publish my submitted biography, business information, links, logo, and approved photographs for a member spotlight." required /></div>}
          </div>
        </FormSection>

        <FormSection headingAs="h2" index="06 — Public member directory" title="Shape Your Listing" description="Directory participation is optional and subject to review and approval. If you are approved, we will ask for your business logo then.">
          <div className="grid gap-8">
            <RadioGroup name="directory" legend="Would you like to apply for the public member directory?" defaultValue="no" onValueChange={setDirectory} variant="list" options={[{ value: "yes", label: "Yes — apply" }, { value: "no", label: "No — keep my information private" }, { value: "info", label: "Send me more information first" }]} />
            {directory === "yes" && <div className="motion-panel-in grid gap-8"><ChoiceGroup name="public-fields" legend="Which information may be displayed publicly?" options={directoryOptions} columns={3} /><div className="grid gap-8 md:grid-cols-2"><Field id="directory-email" label="Public directory email" optional><Input name="directory-email" type="email" /></Field><Field id="directory-phone" label="Public directory phone" optional><Input name="directory-phone" type="tel" /></Field></div><Field id="directory-bio" label="Directory biography" hint="Write 50–100 words in the third person."><LongAnswer name="directory-bio" required /></Field><Field id="services" label="Services or specialties" hint="List up to five."><Input name="services" required /></Field><Checkbox name="directory-consent" label="I authorize publication of the selected information on The Women’s Collective website." required /></div>}
          </div>
        </FormSection>

        {directory === "yes" && <FormSection headingAs="h2" index="07 — Official headshot" title="A Consistent Collective Portrait" description="Required only for approved public directory members.">
          <div className="grid gap-8">
            <FormNotice headingAs="h3" title="A paid official session is required" tone="accent"><p>Approved directory applicants attend a professional headshot session with the collective’s official photographer. Personal or previously taken headshots cannot be used. Price, dates, location, payment instructions, and booking details are shared before scheduling.</p><p className="mt-3">A profile is not published until the application is approved and the session is booked, paid for, and completed.</p></FormNotice>
            <RadioGroup name="headshot-contact" legend="How should we contact you to schedule your headshot?" options={choices(["Email", "Phone", "Text", "WhatsApp"])} />
            <Checkbox name="headshot-paid-session" label="I understand that a paid session with the official photographer is mandatory for the public directory." required />
            <Checkbox name="headshot-official-only" label="I understand I cannot provide my own headshot and my profile will wait until the official session is paid for and completed." required />
            <Checkbox name="headshot-photo-consent" label="I authorize photography and the cropping, resizing, light retouching, and publication of the selected image across collective channels." required />
            <Checkbox name="headshot-extra-fees" label="I understand additional photographs, advanced retouching, prints, or other deliverables may require an additional fee." required />
            <Checkbox name="headshot-placement" label="I understand payment does not guarantee permanent directory placement, which remains subject to approval and community guidelines." required />
          </div>
        </FormSection>}

        <FormSection headingAs="h2" index="08 — Events and partnerships" title="Take Part Your Way" description="Attend, contribute, host, or collaborate.">
          <div className="grid gap-8"><ChoiceGroup name="events" legend="How would you like to participate in events?" options={eventOptions} /><RadioGroup name="partner" legend="Would you like to become a sponsor or community partner?" defaultValue="no" onValueChange={setPartner} options={choices(["yes", "maybe", "no"])} />{partner !== "no" && <Field id="partner-interest" label="Describe your interest"><LongAnswer name="partner-interest" required /></Field>}</div>
        </FormSection>

        <FormSection headingAs="h2" index="09 — Communication" title="Stay in the Loop" description="Choose what reaches your inbox.">
          <div className="grid gap-8"><RadioGroup name="newsletter" legend="Receive news, event invitations, opportunities, and updates?" defaultValue="yes" onValueChange={setNewsletter} options={choices(["yes", "no"])} />{newsletter === "yes" && <Checkbox name="newsletter-consent" label="I consent to receive collective email and understand I can unsubscribe at any time." required />}<RadioGroup name="application-contact" legend="May we contact you directly about your application?" options={choices(["Email", "Phone", "Text", "WhatsApp", "Any of these"])} /></div>
        </FormSection>

        <FormSection headingAs="h2" index="10 — Community guidelines" title="Keep It Generous" description="Confirm each commitment before submitting.">
          <div className="grid gap-8">
            {/* Same look as a ChoiceGroup, but every guideline is its own required commitment. */}
            <fieldset className="rounded-card border border-line bg-canvas p-5 transition-[border-color,box-shadow] duration-300 focus-within:border-sky focus-within:shadow-soft">
              <legend className="px-1 font-sans text-xs font-medium uppercase text-ink">Community guidelines<span className="ml-1 text-danger" aria-hidden>*</span></legend>
              <div className="grid gap-x-8 gap-y-4">{GUIDELINES.map((guideline) => <Checkbox key={guideline} name="guidelines" value={guideline} label={guideline} required />)}</div>
            </fieldset>
            <FormNotice headingAs="h3" title="Privacy and membership"><p>We use submitted information to review applications, communicate with applicants, manage community programs and events, schedule official headshot sessions, and—with permission—create directory listings and spotlights.</p><p className="mt-3">Private information is not intentionally published. Information you choose to share in member groups or at events may be visible to other participants. The collective may moderate spaces and decline or remove participation when needed to protect the community.</p></FormNotice>
          </div>
        </FormSection>

        <FormSection headingAs="h2" index="11 — Final confirmation" title="Make It Official" description="One final review, then send.">
          <div className="grid gap-8 md:grid-cols-2">
            <Field id="heard" label="How did you hear about us?" optional><Select name="heard" defaultValue=""><option value="">Choose one</option>{heardOptions.map((item) => <option key={item}>{item}</option>)}</Select></Field>
            <Field id="referrer" label="Name of the member who referred you" optional><Input name="referrer" /></Field>
            <Field id="signature" label="Electronic signature"><Input name="signature" required /></Field>
            <Field id="date" label="Date"><Input name="date" type="date" required /></Field>
            <div className="md:col-span-2"><Checkbox name="final-confirmation" label="By submitting, I confirm that I have read, understood, and agreed to the permissions, statements, and community guidelines in this application." required /></div>
          </div>
          {failure && (
            <FormNotice headingAs="h3" ref={alert} tabIndex={-1} role="alert" title={failure.kind === "send" ? "We Couldn’t Send That Yet" : "One More Thing"} className="mt-12 border-danger outline-none">
              <p>{failure.message}</p>
              {/* A second submit button: Retry re-reads and re-validates the form as it is now. */}
              {failure.kind === "send" && <Button type="submit" variant="ink" size="sm" {...pending} className={`mt-4 ${pending.className}`}>Retry</Button>}
            </FormNotice>
          )}
          <FormActions className="mt-12"><p className="mr-auto max-w-md font-sans text-xs leading-relaxed text-ink-muted">Leaving an optional question unanswered never counts as permission.</p><Button type="submit" variant="ink" size="lg" {...pending}>Submit application <span aria-hidden>↗</span></Button></FormActions>
        </FormSection>
      </div>
    </form>
  );
}
