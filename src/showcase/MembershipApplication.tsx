import * as React from "react";
import {
  BrandLockup, Button, Checkbox, ChoiceGroup, FileUpload, FormActions, FormField, FormNotice, FormProgress,
  FormSection, Heading, Input, RadioGroup, Select, Text, Textarea,
} from "@/index";

const progress = ["About", "Work", "Community", "WhatsApp", "Spotlight", "Directory", "Headshot", "Events", "Contact", "Guidelines", "Finish"];
const choices = (labels: string[]) => labels.map((label) => ({ value: label, label }));
const connectionOptions = choices(["I live here", "I work here", "I own a business here", "I have clients here", "I regularly participate in the local community", "Other"]);
const industryOptions = choices(["Arts and culture", "Beauty and wellness", "Coaching and consulting", "Design and interiors", "Education", "Finance and legal", "Food and hospitality", "Health and fitness", "Marketing and media", "Mental health and healing", "Nonprofit and community work", "Parenting and family services", "Real estate", "Retail and products", "Technology", "Travel", "Writing and publishing", "Other"]);
const communityOptions = choices(["Professional connections", "Friendship and community", "Referrals", "Collaborators", "Clients", "Mentorship", "Education", "Local events", "Speaking opportunities", "Vendor opportunities", "Community resources", "Business visibility"]);
const supportOptions = choices(["Give referrals", "Make introductions", "Share knowledge", "Mentor", "Collaborate", "Host an event", "Sponsor an event", "Offer a member benefit", "Volunteer", "Other"]);
const directoryOptions = choices(["Full name", "Professional title", "Business name", "Business description", "Neighborhood", "Website", "Instagram", "LinkedIn", "Public email", "Public business phone", "Business logo"]);
const eventOptions = choices(["Attend events", "Speak or teach", "Host an event", "Offer a venue", "Sponsor an event", "Provide products or services", "Volunteer"]);
const guidelineOptions = choices([
  "I will treat members with respect and professionalism.",
  "I will not use the community for spam, aggressive sales, or mass messaging.",
  "I will protect other members’ personal and business information.",
  "I understand the community is for genuine relationships, local connection, and collaboration.",
  "I understand membership and directory publication are subject to review.",
  "I confirm that this application is accurate and I may represent the business listed.",
]);

function Field({ id, label, optional, hint, children }: { id: string; label: string; optional?: boolean; hint?: string; children: React.ReactNode }) {
  return <FormField htmlFor={id} label={label} optional={optional} hint={hint}>{children}</FormField>;
}

export function MembershipApplication() {
  const [location, setLocation] = React.useState("");
  const [industry, setIndustry] = React.useState<string[]>([]);
  const [whatsApp, setWhatsApp] = React.useState("no");
  const [spotlight, setSpotlight] = React.useState("no");
  const [directory, setDirectory] = React.useState("no");
  const [newsletter, setNewsletter] = React.useState("yes");
  const [partner, setPartner] = React.useState("no");
  const [submitted, setSubmitted] = React.useState(false);

  if (submitted) return (
    <div className="motion-panel-in grid min-h-[32rem] place-items-center bg-mint p-8 text-center md:p-16" role="status">
      <div className="max-w-xl">
        <span className="font-sans text-xs font-medium uppercase text-ink-muted">Application received</span>
        <Heading className="mt-5">Thank You for Introducing Yourself</Heading>
        <Text className="mt-5">We are excited to learn more about you and your work. Your application will be reviewed, and we will contact you if we need anything else.</Text>
        <Button variant="ink" className="mt-8" onClick={() => setSubmitted(false)}>Review another application</Button>
      </div>
    </div>
  );

  return (
    <form className="tone-light mx-auto w-full max-w-4xl bg-canvas" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
      <header className="motion-stagger border-b border-line bg-paper px-6 py-12 md:px-12 md:py-16">
        <div className="flex items-center justify-between gap-5"><BrandLockup /><span className="rounded-full border border-line px-3 py-1 font-sans text-xs uppercase">New members</span></div>
        <p className="mt-16 font-sans text-xs font-medium uppercase text-ink-muted">Membership application</p>
        <Heading as="h1" size="display" className="mt-4 max-w-3xl text-[3.25rem] leading-[1.03] sm:text-6xl md:text-[5.25rem]">Tell Us About Your Place in the Constellation</Heading>
        <Text className="mt-5 max-w-xl">Complete this application so we can learn about you, your work, and how you would like to participate in The Women’s Collective.</Text>
        <FormProgress items={progress} current={0} className="mt-12" />
      </header>

      <div className="space-y-20 px-6 py-12 md:px-12 md:py-16">
        <FormSection index="01 — Personal information" title="Start With You" description="Private details stay private unless you explicitly authorize publication.">
          <div className="grid gap-8 md:grid-cols-2">
            <Field id="full-name" label="Full name"><Input id="full-name" name="full-name" autoComplete="name" required /></Field>
            <Field id="preferred-name" label="Preferred name" optional><Input id="preferred-name" name="preferred-name" /></Field>
            <Field id="pronouns" label="Pronouns" optional><Input id="pronouns" name="pronouns" /></Field>
            <Field id="email" label="Email address"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
            <Field id="phone" label="Phone number"><Input id="phone" name="phone" type="tel" autoComplete="tel" required /></Field>
            <Field id="neighborhood" label="Where are you based?"><Select id="neighborhood" name="neighborhood" required value={location} onChange={(event) => setLocation(event.currentTarget.value)}><option value="">Choose a neighborhood</option>{["Long Island City", "Astoria", "Sunnyside", "Woodside", "Jackson Heights", "Elmhurst", "East Elmhurst", "Forest Hills", "Rego Park", "Another Queens neighborhood", "Brooklyn", "Manhattan", "Other"].map((item) => <option key={item}>{item}</option>)}</Select></Field>
            {(location === "Other" || location === "Another Queens neighborhood") && <Field id="other-location" label="Tell us where you are based"><Input id="other-location" required /></Field>}
            <ChoiceGroup className="md:col-span-2" name="connection" legend="What is your connection to Western Queens?" hint="Select all that apply." options={connectionOptions} required />
          </div>
        </FormSection>

        <FormSection index="02 — About your work" title="Share What You Do" description="Help members understand your work in your own words.">
          <div className="grid gap-8 md:grid-cols-2">
            <Field id="business" label="Business or organization name" optional><Input id="business" name="business" /></Field>
            <Field id="role" label="Professional title or role"><Input id="role" name="role" required /></Field>
            <Field id="website" label="Business website" optional><Input id="website" name="website" type="url" /></Field>
            <Field id="instagram" label="Instagram" optional><Input id="instagram" name="instagram" /></Field>
            <Field id="story" label="Tell us about yourself and your work"><Textarea id="story" name="story" required /></Field>
            <div className="grid gap-8"><Field id="linkedin" label="LinkedIn" optional><Input id="linkedin" type="url" /></Field><Field id="social" label="Other social or professional profile" optional><Input id="social" type="url" /></Field></div>
            <ChoiceGroup className="md:col-span-2" name="industry" legend="Industry" hint="Select all that apply." options={industryOptions} columns={3} required onValueChange={setIndustry} />
            {industry.includes("Other") && <Field id="other-industry" label="Describe your industry"><Input id="other-industry" required /></Field>}
          </div>
        </FormSection>

        <FormSection index="03 — Community connections" title="Find Your People" description="Tell us what meaningful support looks like for you.">
          <div className="grid gap-8">
            <ChoiceGroup name="community-goals" legend="What are you hoping to find through the collective?" options={communityOptions} columns={2} required />
            <div className="grid gap-8 md:grid-cols-2"><Field id="ideal-referral" label="Your ideal referral or connection"><Textarea id="ideal-referral" required /></Field><Field id="community-support" label="How can the community support you?" optional><Textarea id="community-support" /></Field></div>
            <ChoiceGroup name="member-support" legend="How would you like to support other members?" options={supportOptions} required />
            <RadioGroup name="coffee" legend="Are you open to one-to-one meetings or coffee chats?" options={choices(["Yes — in person", "Yes — virtually", "Yes — either", "Not at this time"])} />
            <ChoiceGroup name="contact-preference" legend="How do you prefer members to contact you?" options={choices(["Email", "Phone", "Text", "WhatsApp", "Instagram", "LinkedIn"])} columns={3} />
            <Field id="local-shoutout" label="Shout out a local business, organization, or resource you love" optional><Textarea id="local-shoutout" /></Field>
          </div>
        </FormSection>

        <FormSection index="04 — WhatsApp community" title="Join the Conversation" description="Your number will be visible to other group members.">
          <div className="grid gap-8">
            <RadioGroup name="whatsapp" legend="Would you like to join the WhatsApp community?" defaultValue="no" onValueChange={setWhatsApp} options={choices(["yes", "no"])} />
            {whatsApp === "yes" && <div className="motion-panel-in grid gap-6 rounded-card bg-mint p-6"><Field id="whatsapp-number" label="WhatsApp phone number"><Input id="whatsapp-number" type="tel" required /></Field><Checkbox label="I understand my phone number will be visible to group members." required /><Checkbox label="I will keep the space respectful and free from spam or harassment." required /></div>}
          </div>
        </FormSection>

        <FormSection index="05 — Member spotlight" title="Let Your Work Shine" description="Spotlights are optional and published only with permission.">
          <div className="grid gap-8">
            <RadioGroup name="spotlight" legend="Would you like to be considered for a member spotlight?" defaultValue="no" onValueChange={setSpotlight} options={choices(["yes", "no", "Please contact me first"])} />
            {spotlight === "yes" && <div className="motion-panel-in grid gap-6"><Field id="spotlight-focus" label="What would you most like us to highlight?"><Textarea id="spotlight-focus" required /></Field><Checkbox label="I authorize The Women’s Collective to edit and publish my submitted biography, business information, links, logo, and approved photographs for a member spotlight." required /></div>}
          </div>
        </FormSection>

        <FormSection index="06 — Public member directory" title="Shape Your Listing" description="Directory participation is optional and subject to review and approval.">
          <div className="grid gap-8">
            <RadioGroup name="directory" legend="Would you like to apply for the public member directory?" defaultValue="no" onValueChange={setDirectory} variant="list" options={[{ value: "yes", label: "Yes — apply" }, { value: "no", label: "No — keep my information private" }, { value: "info", label: "Send me more information first" }]} />
            {directory === "yes" && <div className="motion-panel-in grid gap-8"><ChoiceGroup name="public-fields" legend="Which information may be displayed publicly?" options={directoryOptions} columns={3} /><div className="grid gap-8 md:grid-cols-2"><Field id="directory-email" label="Public directory email" optional><Input id="directory-email" type="email" /></Field><Field id="directory-phone" label="Public directory phone" optional><Input id="directory-phone" type="tel" /></Field></div><Field id="directory-bio" label="Directory biography" hint="Write 50–100 words in the third person."><Textarea id="directory-bio" required /></Field><Field id="services" label="Services or specialties" hint="List up to five."><Input id="services" required /></Field><FileUpload label="Upload your business logo" hint="Optional · maximum 5 MB · this does not replace your official headshot" accept="image/jpeg,image/png,image/webp" /><Checkbox label="I authorize publication of the selected information on The Women’s Collective website." required /></div>}
          </div>
        </FormSection>

        {directory === "yes" && <FormSection index="07 — Official headshot" title="A Consistent Collective Portrait" description="Required only for approved public directory members.">
          <div className="grid gap-8">
            <FormNotice title="A paid official session is required" tone="accent"><p>Approved directory applicants attend a professional headshot session with the collective’s official photographer. Personal or previously taken headshots cannot be used. Price, dates, location, payment instructions, and booking details are shared before scheduling.</p><p className="mt-3">A profile is not published until the application is approved and the session is booked, paid for, and completed.</p></FormNotice>
            <RadioGroup name="headshot-contact" legend="How should we contact you to schedule your headshot?" options={choices(["Email", "Phone", "Text", "WhatsApp"])} />
            <Checkbox label="I understand that a paid session with the official photographer is mandatory for the public directory." required />
            <Checkbox label="I understand I cannot provide my own headshot and my profile will wait until the official session is paid for and completed." required />
            <Checkbox label="I authorize photography and the cropping, resizing, light retouching, and publication of the selected image across collective channels." required />
            <Checkbox label="I understand additional photographs, advanced retouching, prints, or other deliverables may require an additional fee." required />
            <Checkbox label="I understand payment does not guarantee permanent directory placement, which remains subject to approval and community guidelines." required />
          </div>
        </FormSection>}

        <FormSection index="08 — Events and partnerships" title="Take Part Your Way" description="Attend, contribute, host, or collaborate.">
          <div className="grid gap-8"><ChoiceGroup name="events" legend="How would you like to participate in events?" options={eventOptions} /><RadioGroup name="partner" legend="Would you like to become a sponsor or community partner?" defaultValue="no" onValueChange={setPartner} options={choices(["yes", "maybe", "no"])} />{partner !== "no" && <Field id="partner-interest" label="Describe your interest"><Textarea id="partner-interest" required /></Field>}</div>
        </FormSection>

        <FormSection index="09 — Communication" title="Stay in the Loop" description="Choose what reaches your inbox.">
          <div className="grid gap-8"><RadioGroup name="newsletter" legend="Receive news, event invitations, opportunities, and updates?" defaultValue="yes" onValueChange={setNewsletter} options={choices(["yes", "no"])} />{newsletter === "yes" && <Checkbox label="I consent to receive collective email and understand I can unsubscribe at any time." required />}<RadioGroup name="application-contact" legend="May we contact you directly about your application?" options={choices(["Email", "Phone", "Text", "WhatsApp", "Any of these"])} /></div>
        </FormSection>

        <FormSection index="10 — Community guidelines" title="Keep It Generous" description="Confirm each commitment before submitting.">
          <div className="grid gap-8"><ChoiceGroup name="guidelines" legend="Community guidelines" options={guidelineOptions} columns={1} required /><FormNotice title="Privacy and membership"><p>We use submitted information to review applications, communicate with applicants, manage community programs and events, schedule official headshot sessions, and—with permission—create directory listings and spotlights.</p><p className="mt-3">Private information is not intentionally published. Information you choose to share in member groups or at events may be visible to other participants. The collective may moderate spaces and decline or remove participation when needed to protect the community.</p></FormNotice></div>
        </FormSection>

        <FormSection index="11 — Final confirmation" title="Make It Official" description="One final review, then send.">
          <div className="grid gap-8 md:grid-cols-2">
            <Field id="heard" label="How did you hear about us?" optional><Select id="heard"><option>Choose one</option><option>A current member</option><option>An event</option><option>Social media</option><option>Newsletter</option><option>Search</option><option>Word of mouth</option><option>Other</option></Select></Field>
            <Field id="referrer" label="Name of the member who referred you" optional><Input id="referrer" /></Field>
            <Field id="signature" label="Electronic signature"><Input id="signature" required /></Field>
            <Field id="date" label="Date"><Input id="date" type="date" required /></Field>
            <div className="md:col-span-2"><Checkbox label="By submitting, I confirm that I have read, understood, and agreed to the permissions, statements, and community guidelines in this application." required /></div>
          </div>
          <FormActions className="mt-12"><p className="mr-auto max-w-md font-sans text-xs leading-relaxed text-ink-muted">Leaving an optional question unanswered never counts as permission.</p><Button type="submit" variant="ink" size="lg">Submit application <span aria-hidden>↗</span></Button></FormActions>
        </FormSection>
      </div>
    </form>
  );
}