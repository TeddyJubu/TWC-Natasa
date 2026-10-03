import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion, BigCountdown, Button, Container, CurvedGallery, FeatureCard, FormField, Hero, ImageFrame, Input,
  Navbar, Ribbon, Section, SectionHeader, Select, Split, Stat, Statement, Tabs, Text, Textarea, Timeline, Footer,
  Badge, Heading, Wordmark,
} from "@/index";
import { Shell } from "@/showcase/Shell";
import hero from "@/assets/photography/hero.jpg";
import p1 from "@/assets/photography/portrait-1.jpg";
import p2 from "@/assets/photography/portrait-2.jpg";
import p3 from "@/assets/photography/portrait-3.jpg";
import event from "@/assets/photography/event.jpg";
import flower from "@/assets/illustrations/flower.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bloom — Sky, sun and serif design system" },
      { name: "description", content: "A bright editorial design system for community and membership websites." },
      { property: "og:title", content: "Bloom — Sky, sun and serif design system" },
      { property: "og:description", content: "A bright editorial design system for community and membership websites." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Sample,
});

const links = [
  { label: "About", href: "#about" },
  { label: "Programs", href: "#programs" },
  { label: "Events", href: "#events" },
  { label: "Join", href: "#join" },
];

function StoryPanel({ img, title, year, body }: { img: string; title: string; year: string; body: string }) {
  return (
    <div className="grid gap-12 md:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Text>{body}</Text>
        <ImageFrame src={img} alt="" shape="thumb" ratio="square" className="w-32" />
        <div className="flex items-end justify-between gap-6">
          <Heading as="h3" size="title" className="max-w-40">{title}</Heading>
          <Stat value={year} />
        </div>
      </div>
      <div className="relative grid min-h-96 place-items-center overflow-hidden rounded-card bg-black">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2"><Ribbon text={title} /></div>
        <ImageFrame src={img} alt="" shape="card" ratio="auto" className="relative h-60 w-60" />
      </div>
    </div>
  );
}

function Sample() {
  return (
    <Shell bare>
      <Hero
        image={hero}
        imageAlt="Woman in a white suit standing in a yellow flower field"
        nav={<Navbar variant="overlay" brand={<Wordmark>Bloom</Wordmark>} links={links} action={<Button variant="white">Become a member</Button>} />}
        badge="A Community of Makers"
        title="Bold Ideas, One Brilliant Circle"
        description="Placeholder intro line that sits quietly on the right of the hero."
        info={{ image: event, text: "Spring Summit, Rooftop Hall" }}
        highlight={{ value: "24", label: "April 2027" }}
      />

      <Section id="about" className="pt-8">
        <Container className="flex flex-col items-center gap-10 text-center">
          <Badge>A Community of Makers</Badge>
          <Statement lead={2} text="We're building something together. A short statement fades from ink to faint grey so one phrase leads the eye." />
          <Button>Join the circle</Button>
        </Container>
      </Section>
      <CurvedGallery images={[{ src: p3, alt: "" }, { src: p1, alt: "" }, { src: p2, alt: "" }, { src: p3, alt: "" }, { src: p1, alt: "" }]} />

      <Section id="programs">
        <Container className="flex flex-col gap-16">
          <SectionHeader badge="Programs" title="Three Paths, One Shared Journey" />
          <Tabs items={[
            { label: "Mentorship", content: <StoryPanel img={p2} title="Mentorship" year="2019" body="Tabs swap a two-column panel: body copy, a small thumbnail, a serif label and an oversized number on the left; a black media card with a yellow ribbon on the right." /> },
            { label: "Masterclasses", content: <StoryPanel img={p1} title="Masterclasses" year="2022" body="Each panel shares the same rhythm so switching tabs feels calm and predictable." /> },
            { label: "Gatherings", content: <StoryPanel img={p3} title="Gatherings" year="2025" body="Keep body copy to a short paragraph — the serif headline carries the tone." /> },
          ]} />
        </Container>
      </Section>

      <Section tone="dome" id="events">
        <Container className="flex flex-col gap-16">
          <div className="flex flex-col items-center gap-7 text-center">
            <Badge variant="solid">Save the Date</Badge>
            <Heading className="max-w-xl">A Season Worth Showing Up For</Heading>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1.9fr_1fr]">
            <FeatureCard tag="Rooftop Hall, Level 12" title="Summit" className="tone-light" />
            <FeatureCard variant="photo" image={event} title="Talks, Dinner & A Night to Remember" description="Photo cards carry a white rule, a serif title and a short paragraph over a soft dark gradient." />
            <FeatureCard tag="7:00 PM" title="Mixer" className="tone-light" />
          </div>
        </Container>
      </Section>
      <Section tone="night" className="pt-8">
        <Container className="flex flex-col items-center gap-24">
          <div className="flex flex-col items-center gap-10">
            <Badge variant="solid">Counting Down</Badge>
            <BigCountdown target="2027-04-24" ornament={flower} />
          </div>
          <SectionHeader badge="Agenda" title="Shape of the Day" intro="A centered line with alternating entries, small rounded thumbnails and white dots." />
          <Timeline className="w-full" items={[
            { time: "09:00 AM", title: "Arrival & Coffee", description: "Short description for this moment.", image: event },
            { time: "10:30 AM", title: "Founder Keynote", description: "Short description for this moment.", image: p2 },
            { time: "01:00 PM", title: "Roundtables", description: "Short description for this moment.", image: p1 },
            { time: "06:30 PM", title: "Evening Mixer", description: "Short description for this moment.", image: p3 },
          ]} />
          <div id="join" className="w-full">
            <Split media={<ImageFrame src={event} alt="Members chatting at an evening event" ratio="square" />}>
              <Badge variant="solid" className="self-start">Membership</Badge>
              <Heading>Will You Join Us?</Heading>
              <Text>Forms sit on night sections with soft surface inputs and a sky-blue submit.</Text>
              <form className="grid gap-5 md:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
                <FormField label="Name" htmlFor="n"><Input id="n" placeholder="Jane Smith" /></FormField>
                <FormField label="Email" htmlFor="e"><Input id="e" type="email" placeholder="jane@company.com" /></FormField>
                <FormField className="md:col-span-2" label="Plan" htmlFor="pl"><Select id="pl"><option>Founder</option><option>Studio</option></Select></FormField>
                <FormField className="md:col-span-2" label="Message" htmlFor="m"><Textarea id="m" placeholder="Tell us about your work" /></FormField>
                <Button className="md:col-span-2">Submit</Button>
              </form>
            </Split>
          </div>
        </Container>
      </Section>

      <Section>
        <Container width="narrow" className="flex flex-col gap-14">
          <SectionHeader badge="FAQs" title="Questions" intro="Rounded soft panels that open with a rotating plus." />
          <Accordion items={[
            { question: "Who can apply?", answer: "Placeholder answer copy." },
            { question: "How often do you meet?", answer: "Placeholder answer copy." },
            { question: "Is there a trial?", answer: "Placeholder answer copy." },
          ]} />
        </Container>
      </Section>
      <Footer
        brand={<Wordmark>Bloom</Wordmark>}
        statement="A short closing line in large serif."
        contacts={[{ label: "Phone", value: "(000) 123-4567" }, { label: "Email", value: "hello@example.com", href: "mailto:hello@example.com" }]}
        links={[{ label: "Privacy Policy", href: "#" }, { label: "Terms", href: "#" }]}
        note="© 2027 Bloom"
      />
    </Shell>
  );
}
