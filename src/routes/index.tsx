import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Accordion, Badge, BrandLockup, ConstellationLogo, Container, CurvedGallery, FeatureCard, Footer,
  Heading, Hero, ImageFrame, Navbar, Ribbon, Section, SectionHeader, Split, Statement, Text, buttonVariants,
} from "@/index";
import { Shell } from "@/showcase/Shell";
import hero from "@/assets/photography/hero.jpg";
import p1 from "@/assets/photography/portrait-1.jpg";
import p2 from "@/assets/photography/portrait-2.jpg";
import p3 from "@/assets/photography/portrait-3.jpg";
import event from "@/assets/photography/event.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Women’s Collective — Find your people in Queens" },
      { name: "description", content: "A community for women founders, entrepreneurs, creatives, freelancers, professionals, and neighbors across Western Queens." },
      { property: "og:title", content: "The Women’s Collective — Find your people in Queens" },
      { property: "og:description", content: "Meet, share knowledge, support women’s work, and build real relationships close to home." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const links = [
  { label: "Our mission", href: "#mission" },
  { label: "Our constellation", href: "#constellation" },
  { label: "Take part", href: "#take-part" },
  { label: "Join", href: "/join" },
];

const neighborhoods = [
  { name: "Long Island City", color: "bg-lic", logo: "long-island-city" as const },
  { name: "Sunnyside", color: "bg-sunnyside", logo: "sunnyside" as const },
  { name: "Astoria", color: "bg-astoria", logo: "astoria" as const },
  { name: "Jackson Heights", color: "bg-jackson-heights", logo: "jackson-heights" as const },
  { name: "Elmhurst", color: "bg-elmhurst", logo: "elmhurst" as const },
  { name: "Forest Hills", color: "bg-forest-hills", logo: "forest-hills" as const },
  { name: "Rego Park", color: "bg-rego-park", logo: "rego-park" as const },
];

function HomePage() {
  return (
    <Shell bare>
      <Hero
        image={hero}
        imageAlt="Woman standing in a field beneath an open sky"
        nav={<Navbar variant="overlay" brand={<BrandLockup logoVariant="white" compact />} links={links} action={<Link to="/join" className={buttonVariants({ variant: "white" })}>Join the collective</Link>} />}
        badge="Western Queens, New York"
        title="Find Your People. Help Someone Else Shine."
        description="For women building businesses, careers, creative work, and real relationships close to home."
        info={{ image: event, text: "A generous, engaged community across Queens." }}
        highlight={{ value: "7", label: "Neighborhood colors" }}
      />

      <Section id="mission" className="pt-12">
        <Container className="flex flex-col items-center gap-10 text-center">
          <Badge>Our mission</Badge>
          <Statement lead={4} text="The Women’s Collective brings women across Queens together to meet, share knowledge, support one another’s work, and build real relationships close to home." />
          <Text size="lg" className="max-w-3xl">When women know who is around them, they can recommend each other, collaborate, show up for each other’s events, and create opportunities that would be harder to build alone.</Text>
          <Link to="/join" className={buttonVariants()}>Introduce yourself</Link>
        </Container>
      </Section>

      <CurvedGallery images={[{ src: p3, alt: "Woman smiling outdoors" }, { src: p1, alt: "Creative professional portrait" }, { src: p2, alt: "Woman entrepreneur portrait" }, { src: p3, alt: "Woman smiling outdoors" }, { src: p1, alt: "Creative professional portrait" }]} />

      <Section id="take-part">
        <Container className="flex flex-col gap-16">
          <SectionHeader badge="Inside the collective" title="Connections That Move Work Forward" intro="Not networking for networking’s sake. This is a place to build genuine relationships and support women-owned work." />
          <div className="grid gap-3 md:grid-cols-3">
            <FeatureCard tag="01" title="Share What You Do" description="Introduce your business, work, or project and help neighbors understand what you bring." className="bg-mint" />
            <FeatureCard variant="photo" image={event} title="Find Collaborators" description="Build partnerships, exchange referrals, and discover opportunities through people nearby." />
            <FeatureCard tag="03" title="Show Up Locally" description="Promote women-owned businesses and learn about gatherings, events, and meetups across Queens." className="bg-lilac" />
          </div>
        </Container>
      </Section>

      <Section tone="dome" id="constellation">
        <Container className="flex flex-col gap-16">
          <div className="flex flex-col items-center gap-7 text-center">
            <Badge variant="solid">Our constellation</Badge>
            <ConstellationLogo variant="white" size="display" />
            <Heading className="max-w-3xl">Every Connection Makes the Whole Community Stronger</Heading>
            <Text className="max-w-2xl">Each neighborhood has its own identity and color. The central star is the point where those neighborhoods and connections meet.</Text>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {neighborhoods.map((item) => (
              <article key={item.name} className={`${item.color} motion-scroll-reveal flex min-h-56 flex-col justify-between rounded-card p-6 text-white`}>
                <ConstellationLogo variant={item.logo} size="sm" className="brightness-0 invert" aria-hidden alt="" />
                <h3 className="font-display text-3xl">{item.name}</h3>
              </article>
            ))}
          </div>
          <Split media={<ImageFrame src={p2} alt="A woman in the collective" shape="panel" ratio="square" />}>
            <Badge variant="solid">Constellation Captain</Badge>
            <Heading as="h3" size="section">Meet Shauna</Heading>
            <Text size="lg">Shauna helps bring women together across the different areas and keeps the connections active and personal.</Text>
          </Split>
        </Container>
      </Section>

      <div className="overflow-hidden"><Ribbon text="Long Island City · Astoria · Sunnyside · Woodside · Jackson Heights · Elmhurst · Forest Hills · Rego Park" /></div>

      <Section className="bg-paper">
        <Container className="flex flex-col items-center gap-10 text-center">
          <SectionHeader badge="Membership" title="There Is Room in This Constellation" intro="The application helps us learn about you, your work, and how you would like to participate in the community." />
          <Link to="/join" className={buttonVariants({ variant: "primary", size: "lg" })}>Start your application</Link>
        </Container>
      </Section>

      <Section>
        <Container width="narrow" className="flex flex-col gap-14">
          <SectionHeader badge="A collective for Queens" title="Come As You Are" />
          <Accordion items={[
            { question: "Who is the collective for?", answer: "Women founders, entrepreneurs, creatives, freelancers, professionals, and neighbors who want to contribute to a generous, engaged community." },
            { question: "Which neighborhoods are included?", answer: "Long Island City, Astoria, Sunnyside, Woodside, Jackson Heights, Elmhurst, East Elmhurst, Forest Hills, Rego Park, and surrounding Queens neighborhoods." },
            { question: "Is the community inclusive?", answer: "Yes. We welcome women from all backgrounds, including moms, married and single women, LGBTQ+ members, non-binary people who feel aligned with the community, immigrants, international members, and people from diverse cultures." },
          ]} />
        </Container>
      </Section>

      <Footer
        brand={<BrandLockup logoVariant="white" />}
        statement="Find your people, share what you do, and help someone else shine."
        links={[{ label: "Our mission", href: "#mission" }, { label: "Join", href: "/join" }]}
        note="The Women’s Collective · Western Queens"
      />
    </Shell>
  );
}