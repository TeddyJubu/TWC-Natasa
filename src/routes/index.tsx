import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion, Button, Container, Countdown, Divider, EventCard, Footer, Gallery, Hero, ImageFrame,
  Input, FormField, RadioGroup, Schedule, Section, SectionHeader, Split, Textarea, Timeline, Heading, Text, Eyebrow, Monogram,
} from "@/index";
import { Shell } from "@/showcase/Shell";
import meadow from "@/assets/photography/meadow.jpg";
import table from "@/assets/photography/table.jpg";
import bouquet from "@/assets/photography/bouquet.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Keepsake — Romantic editorial design system" },
      { name: "description", content: "Warm paper, ink and rose: a design system for invitations, celebrations and heartfelt pages." },
      { property: "og:title", content: "Keepsake — Romantic editorial design system" },
      { property: "og:description", content: "Warm paper, ink and rose: a design system for invitations and celebrations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

function Overview() {
  return (
    <Shell>
      <Hero
        eyebrow="An Evening in the Garden"
        title={<>Gathered Under <em>Golden</em> Light</>}
        description="A sample page assembled entirely from Keepsake — warm paper, ink-dark serif type and a single rose accent."
        meta={["Saturday, 12 June", "The Old Orchard, Somerset"]}
        actions={<><Button variant="accent">Reply to invite</Button><Button variant="outline">See the day</Button></>}
        media={<ImageFrame src={meadow} alt="Two people walking through a meadow at sunset" width={1024} height={1280} />}
      />
      <Section tone="surface">
        <Container>
          <Split media={<ImageFrame src={bouquet} alt="Pink garden roses wrapped in cream paper" shape="rounded" ratio="square" />}>
            <Eyebrow>The Story</Eyebrow>
            <Heading>Small beginnings, <em>long</em> remembered</Heading>
            <Text size="lg">Editorial splits pair an arched or softened image with a quiet column of text and a milestone timeline.</Text>
            <Timeline items={[
              { date: "Spring", label: "First hello", description: "A borrowed umbrella on a rainy platform." },
              { date: "Autumn", label: "The question", description: "Asked beneath the old walnut tree." },
              { date: "Summer", label: "The gathering" },
            ]} />
          </Split>
        </Container>
      </Section>
      <Section>
        <Container className="flex flex-col gap-14">
          <SectionHeader eyebrow="Save the Date" title="Two moments, one evening" />
          <div className="grid gap-6 md:grid-cols-2">
            <EventCard image={table} imageAlt="Candlelit dinner table" label="Ceremony" title="Vows in the courtyard" details={[{ term: "Time", value: "4:00 PM" }, { term: "Place", value: "Stone Courtyard" }]} />
            <EventCard variant="ink" label="Reception" title="Dinner, dancing & toasts" details={[{ term: "Time", value: "7:00 PM" }, { term: "Place", value: "The Long Barn" }]}>
              <Text className="mt-2">As the lanterns come on, we'll share a long-table supper and dance until late.</Text>
            </EventCard>
          </div>
        </Container>
      </Section>
      <Section tone="surface">
        <Container width="narrow" className="flex flex-col items-center gap-10 text-center">
          <Monogram size="lg">K</Monogram>
          <Heading>Counting down</Heading>
          <Countdown target="2027-06-12T16:00:00" className="w-full" />
        </Container>
      </Section>
      <Section>
        <Container width="narrow" className="flex flex-col gap-12">
          <SectionHeader eyebrow="Schedule" title="How the day unfolds" />
          <Schedule items={[
            { time: "3:30 PM", title: "Arrival", description: "Lemonade on the lawn as everyone settles in.", image: bouquet },
            { time: "4:00 PM", title: "Ceremony", description: "A short, heartfelt exchange of promises.", image: meadow },
            { time: "7:00 PM", title: "Supper", description: "Seasonal plates served family style.", image: table },
          ]} />
        </Container>
      </Section>
      <Section tone="surface">
        <Container width="narrow" className="flex flex-col gap-10">
          <SectionHeader eyebrow="Reply" title="Will you join us?" intro="Kindly reply by 1 May." />
          <form className="grid gap-6 rounded-card bg-paper p-8 md:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
            <FormField label="Full name" htmlFor="n"><Input id="n" placeholder="Eleanor Hart" /></FormField>
            <FormField label="Email" htmlFor="e"><Input id="e" type="email" placeholder="eleanor@example.com" /></FormField>
            <RadioGroup className="md:col-span-2" name="att" legend="Attending" defaultValue="yes" options={[{ value: "yes", label: "Joyfully accepts" }, { value: "no", label: "Regretfully declines" }]} />
            <FormField className="md:col-span-2" label="A note for us" htmlFor="m"><Textarea id="m" placeholder="Dietary needs, song requests…" /></FormField>
            <Button className="md:col-span-2" variant="accent" size="lg">Send reply</Button>
          </form>
        </Container>
      </Section>
      <Section>
        <Container className="flex flex-col gap-12">
          <SectionHeader eyebrow="Attire" title="What to wear" intro="Garden formal in soft, warm tones." />
          <Gallery images={[{ src: meadow, alt: "Linen outfits" }, { src: bouquet, alt: "Rose palette" }, { src: table, alt: "Evening setting" }]} />
          <Divider />
          <div className="mx-auto w-full max-w-2xl">
            <Accordion items={[
              { question: "Is there parking?", answer: "Yes — the orchard field opens from 3 PM." },
              { question: "Are children welcome?", answer: "Of course. There will be a quiet corner with games." },
            ]} />
          </div>
        </Container>
      </Section>
      <Footer brand={<Monogram size="md">K</Monogram>} statement="Made for the moments worth keeping." note="© Keepsake Design System" links={[{ label: "Colors", href: "/colors" }, { label: "Typography", href: "/typography" }, { label: "Components", href: "/components" }]} />
    </Shell>
  );
}
