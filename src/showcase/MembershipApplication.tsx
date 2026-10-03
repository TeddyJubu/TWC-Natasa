import * as React from "react";
import {
  Button, Checkbox, ChoiceGroup, FileUpload, FormActions, FormField, FormNotice, FormProgress,
  FormSection, Heading, Input, RadioGroup, Select, Text, Textarea, Wordmark,
} from "@/index";

const progress = ["About", "Work", "Community", "Features", "Directory", "Media", "Events", "Contact", "Guidelines", "Signature"];
const connectionOptions = ["I live here", "I work here", "I own a business here", "I have clients here", "I participate locally", "Other connection"].map((label) => ({ value: label, label }));
const industryOptions = ["Arts & culture", "Beauty & wellness", "Coaching & consulting", "Community & nonprofit", "Design & interiors", "Education", "Finance & legal", "Food & hospitality", "Health & fitness", "Marketing & media", "Retail & products", "Technology"].map((label) => ({ value: label, label }));
const communityOptions = ["Professional connections", "Friendship & community", "Referrals", "Collaborators", "Clients", "Mentorship", "Education", "Local events", "Speaking opportunities", "Community resources"].map((label) => ({ value: label, label }));
const supportOptions = ["Giving referrals", "Making introductions", "Sharing knowledge", "Mentoring", "Collaborating", "Hosting events", "Offering member benefits", "Volunteering"].map((label) => ({ value: label, label }));
const directoryOptions = ["Name", "Business name", "Role", "Biography", "Neighborhood", "Website", "Instagram", "LinkedIn", "Public email", "Business phone", "Services", "Business logo"].map((label) => ({ value: label, label }));
const eventOptions = ["Attend events", "Speak or teach", "Host an event", "Offer a venue", "Become a partner", "Provide products", "Volunteer"].map((label) => ({ value: label, label }));
const guidelineOptions = [
  "I will treat members with respect and professionalism.",
  "I will not use the community for spam, aggressive sales, or mass messaging.",
  "I will protect other members’ personal and business information.",
  "I understand the community supports genuine relationships and collaboration.",
  "I understand membership and directory publication are subject to review.",
  "The information in this application is accurate.",
].map((label) => ({ value: label, label }));

function Field({ id, label, optional, hint, children }: { id: string; label: string; optional?: boolean; hint?: string; children: React.ReactNode }) {
  return <FormField htmlFor={id} label={label} optional={optional} hint={hint}>{children}</FormField>;
}

export function MembershipApplication() {
  const [whatsApp, setWhatsApp] = React.useState("no");
  const [directory, setDirectory] = React.useState("no");
  const [newsletter, setNewsletter] = React.useState("yes");
  const [submitted, setSubmitted] = React.useState(false);

  if (submitted) return (
    <div className="motion-panel-in grid min-h-[32rem] place-items-center bg-mint p-8 text-center md:p-16" role="status">
      <div className="max-w-xl">
        <span className="font-sans text-xs font-medium uppercase text-ink-muted">Application received</span>
        <Heading className="mt-5">Thank You For Showing Up</Heading>
        <Text className="mt-5">Your application is ready for a thoughtful, human review. We’ll be in touch soon.</Text>
        <Button variant="ink" className="mt-8" onClick={() => setSubmitted(false)}>Review another application</Button>
      </div>
    </div>
  );

  return (
    <form className="tone-light mx-auto w-full max-w-4xl bg-canvas" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
      <header className="motion-stagger border-b border-line bg-paper px-6 py-12 md:px-12 md:py-16">
        <div className="flex items-center justify-between gap-5"><Wordmark>Bloom</Wordmark><span className="rounded-full border border-line px-3 py-1 font-sans text-xs uppercase">New members</span></div>
        <p className="mt-16 font-sans text-xs font-medium uppercase text-ink-muted">Membership application</p>
        <Heading as="h2" size="display" className="mt-4 max-w-3xl">Join A Brilliant Circle</Heading>
        <Text className="mt-5 max-w-xl">One thoughtful application. Everything happens in this single submission, so you’ll never be asked twice.</Text>
        <FormProgress items={progress} current={0} className="mt-12" />
      </header>

      <div className="space-y-20 px-6 py-12 md:px-12 md:py-16">
        <FormSection index="01 — About you" title="Start With You" description="Private details stay private.">
          <div className="grid gap-8 md:grid-cols-2">
            <Field id="member-name" label="Full name"><Input id="member-name" name="name" required /></Field>
            <Field id="member-email" label="Email address"><Input id="member-email" name="email" type="email" required /></Field>
            <Field id="member-phone" label="Phone number" hint="Used only to contact you about your application."><Input id="member-phone" name="phone" type="tel" required /></Field>
            <Field id="member-address" label="Your address" optional hint="Never shown in a directory or shared."><Input id="member-address" name="address" /></Field>
            <ChoiceGroup className="md:col-span-2" name="connection" legend="What is your connection to your local community?" hint="Select all that apply." options={connectionOptions} required />
            <RadioGroup className="md:col-span-2" name="location" legend="Where are you based?" options={["North", "Central", "East", "South", "West", "Other"].map((label) => ({ value: label, label }))} variant="list" />
          </div>
        </FormSection>

        <FormSection index="02 — Your work" title="Tell Us What You Do" description="The honest version is the useful one.">
          <div className="grid gap-8 md:grid-cols-2">
            <Field id="business" label="Business or organization name"><Input id="business" required /></Field>
            <Field id="role" label="Professional title or role"><Input id="role" required /></Field>
            <Field id="website" label="Business website"><Input id="website" type="url" required /></Field>
            <Field id="instagram" label="Instagram" optional><Input id="instagram" /></Field>
            <Field id="story" label="Tell us about yourself and your work"><Textarea id="story" required /></Field>
            <Field id="linkedin" label="LinkedIn or professional profile" optional><Input id="linkedin" type="url" /></Field>
            <ChoiceGroup className="md:col-span-2" name="industry" legend="Industry" hint="Select all that apply." options={industryOptions} columns={3} required />
          </div>
        </FormSection>

        <FormSection index="03 — Community" title="Find Your People" description="Tell us what a meaningful connection looks like.">
          <div className="grid gap-8">
            <ChoiceGroup name="community-goals" legend="What are you hoping to find?" options={communityOptions} columns={2} required />
            <div className="grid gap-8 md:grid-cols-2"><Field id="ideal-referral" label="Your ideal referral or connection"><Textarea id="ideal-referral" required /></Field><Field id="community-support" label="How can the community support you?" optional><Textarea id="community-support" /></Field></div>
            <ChoiceGroup name="member-support" legend="How would you like to support other members?" options={supportOptions} required />
            <RadioGroup name="coffee" legend="Open to one-to-one meetings or coffee chats?" options={["In person", "Virtually", "Either works", "Not now"].map((label) => ({ value: label, label }))} />
          </div>
        </FormSection>

        <FormSection index="04 — Member features" title="Choose Your Visibility" description="Nothing is shared automatically.">
          <div className="grid gap-8">
            <RadioGroup name="whatsapp" legend="Join the private member chat?" defaultValue="no" onValueChange={setWhatsApp} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
            {whatsApp === "yes" && <div className="motion-panel-in grid gap-6 rounded-card bg-mint p-6 md:grid-cols-2"><Field id="whatsapp-number" label="Chat phone number"><Input id="whatsapp-number" type="tel" required /></Field><Checkbox label="I’ll keep the community respectful, relevant, and free from spam." /></div>}
            <RadioGroup name="spotlight" legend="Be considered for a member spotlight?" options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
            <Field id="spotlight-focus" label="What would you like us to highlight?" optional><Textarea id="spotlight-focus" /></Field>
          </div>
        </FormSection>

        <FormSection index="05 — Directory" title="Shape Your Listing" description="Choose exactly what can appear.">
          <div className="grid gap-8">
            <RadioGroup name="directory" legend="Apply for the member directory?" defaultValue="no" onValueChange={setDirectory} variant="list" options={[{ value: "public", label: "Public listing" }, { value: "members", label: "Members-only listing" }, { value: "no", label: "Do not list me" }]} />
            {directory !== "no" && <div className="motion-panel-in grid gap-8"><ChoiceGroup name="public-fields" legend="Which information may be displayed?" options={directoryOptions} columns={3} /><div className="grid gap-8 md:grid-cols-2"><Field id="directory-email" label="Directory email" optional><Input id="directory-email" type="email" /></Field><Field id="directory-phone" label="Directory phone" optional><Input id="directory-phone" type="tel" /></Field></div><Field id="directory-bio" label="Directory biography" optional hint="Two or three sentences."><Textarea id="directory-bio" /></Field><FileUpload label="Upload your business logo" hint="JPEG, PNG, or WebP · up to 4 MB" accept="image/jpeg,image/png,image/webp" /></div>}
          </div>
        </FormSection>

        <FormSection index="06 — Photography" title="Set Your Boundaries" description="You can choose ask me first.">
          <div className="grid gap-8">
            {["May we photograph or film you at events?", "May we use those images in Bloom channels?", "May event partners share them for event coverage?"].map((legend, index) => <RadioGroup key={legend} name={`media-${index}`} legend={legend} options={["Yes", "No", "Ask me first"].map((label) => ({ value: label, label }))} />)}
          </div>
        </FormSection>

        <FormSection index="07 — Events" title="Take Part Your Way" description="Attend, contribute, or collaborate.">
          <div className="grid gap-8"><ChoiceGroup name="events" legend="How are you interested in participating?" options={eventOptions} /><RadioGroup name="sponsor" legend="Interested in becoming a sponsor or partner?" options={["Yes", "Maybe — send details", "No"].map((label) => ({ value: label, label }))} /><Field id="partner-interest" label="Describe your partnership interest" optional><Textarea id="partner-interest" /></Field></div>
        </FormSection>

        <FormSection index="08 — Contact" title="Stay In The Loop" description="Choose what reaches your inbox.">
          <div className="grid gap-8"><RadioGroup name="newsletter" legend="Receive news, invitations, and community updates?" defaultValue="yes" onValueChange={setNewsletter} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />{newsletter === "yes" && <div className="motion-panel-in"><Checkbox label="I consent to receive Bloom email and understand I can unsubscribe at any time." /></div>}<RadioGroup name="application-contact" legend="How may we contact you about your application?" variant="list" options={["Email only", "Email, phone, or text", "Do not contact me"].map((label) => ({ value: label, label }))} /></div>
        </FormSection>

        <FormSection index="09 — Guidelines" title="Keep It Generous" description="Confirm each community commitment.">
          <div className="grid gap-8"><ChoiceGroup name="guidelines" legend="Community guidelines" options={guidelineOptions} columns={1} required /><FormNotice title="Privacy and membership"><p>Your answers are reviewed by a person. Private contact details are never published. Only fields you select may appear in a listing, and only after approval.</p></FormNotice></div>
        </FormSection>

        <FormSection index="10 — Signature" title="Make It Official" description="One final review, then send.">
          <div className="grid gap-8 md:grid-cols-2">
            <Field id="heard" label="How did you hear about Bloom?" optional><Select id="heard"><option>Choose one</option><option>A current member</option><option>An event</option><option>Social media</option><option>Newsletter</option><option>Search</option><option>Word of mouth</option></Select></Field>
            <Field id="date" label="Date"><Input id="date" type="date" required /></Field>
            <Field id="signature" label="Electronic signature — full legal name"><Input id="signature" required /></Field>
            <div className="flex items-end"><Checkbox label="I confirm this information is accurate and consent to Bloom storing and reviewing it." required /></div>
          </div>
          <FormActions className="mt-12"><p className="mr-auto max-w-md font-sans text-xs leading-relaxed text-ink-muted">Leaving an optional question unanswered means exactly that — never yes.</p><Button type="submit" variant="ink" size="lg">Submit application <span aria-hidden>↗</span></Button></FormActions>
        </FormSection>
      </div>
    </form>
  );
}