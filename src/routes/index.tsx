import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Accordion, Badge, BrandLockup, ConstellationLogo, Container, FeatureCard, Footer,
  Heading, Hero, ImageFrame, Navbar, Ribbon, Section, SectionHeader, Split, Statement, Text, buttonVariants,
} from "@/index";
import { Shell } from "@/showcase/Shell";
import { JOIN_URL, SITE_URL } from "@/lib/site";
import hero from "@/assets/photography/hero.jpg";
import event from "@/assets/photography/event.jpg";
import neighborhoodLic from "@/assets/photography/neighborhood-lic.jpg";
import neighborhoodSunnyside from "@/assets/photography/neighborhood-sunnyside.jpg";
import neighborhoodAstoria from "@/assets/photography/neighborhood-astoria.jpg";
import neighborhoodJacksonHeights from "@/assets/photography/neighborhood-jackson-heights.jpg";
import neighborhoodElmhurst from "@/assets/photography/neighborhood-elmhurst.jpg";
import neighborhoodForestHills from "@/assets/photography/neighborhood-forest-hills.jpg";
import neighborhoodRegoPark from "@/assets/photography/neighborhood-rego-park.jpg";
import neighborhoodGreenpoint from "@/assets/photography/neighborhood-greenpoint.jpg";
import neighborhoodWilliamsburg from "@/assets/photography/neighborhood-williamsburg.jpg";
import neighborhoodBushwick from "@/assets/photography/neighborhood-bushwick.jpg";
import natasa from "@/design-system/assets/photography/natasa-tuohy.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Women’s Collective — Find your people in Brooklyn and Queens" },
      { name: "description", content: "A community for women founders, entrepreneurs, creatives, freelancers, professionals, and neighbors across North Brooklyn and Western Queens." },
      { property: "og:title", content: "The Women’s Collective — Find your people in Brooklyn and Queens" },
      { property: "og:description", content: "Meet, share knowledge, support women’s work, and build real relationships close to home." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:image", content: `${SITE_URL}/og-image.jpg` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Members of The Women’s Collective talking at an evening event" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const links = [
  { label: "Our mission", href: "#mission" },
  { label: "Members", href: "/members" },
  { label: "Our constellation", href: "#constellation" },
  { label: "Take part", href: "#take-part" },
  { label: "Join", href: JOIN_URL },
];

const brooklyn = [
  { name: "Greenpoint", image: neighborhoodGreenpoint, overlay: "from-greenpoint via-greenpoint/55", logo: "greenpoint" as const },
  { name: "Williamsburg", image: neighborhoodWilliamsburg, overlay: "from-williamsburg via-williamsburg/55", logo: "williamsburg" as const },
  { name: "Bushwick", image: neighborhoodBushwick, overlay: "from-bushwick via-bushwick/55", logo: "bushwick" as const },
];

const queens = [
  { name: "Long Island City", image: neighborhoodLic, overlay: "from-lic via-lic/55", logo: "long-island-city" as const },
  { name: "Sunnyside", image: neighborhoodSunnyside, overlay: "from-sunnyside via-sunnyside/55", logo: "sunnyside" as const },
  { name: "Astoria", image: neighborhoodAstoria, overlay: "from-astoria via-astoria/55", logo: "astoria" as const },
  { name: "Jackson Heights", image: neighborhoodJacksonHeights, overlay: "from-jackson-heights via-jackson-heights/55", logo: "jackson-heights" as const },
  { name: "Elmhurst", image: neighborhoodElmhurst, overlay: "from-elmhurst via-elmhurst/55", logo: "elmhurst" as const },
  { name: "Forest Hills", image: neighborhoodForestHills, overlay: "from-forest-hills via-forest-hills/55", logo: "forest-hills" as const },
  { name: "Rego Park", image: neighborhoodRegoPark, overlay: "from-rego-park via-rego-park/55", logo: "rego-park" as const },
];

/** Brooklyn first: the collective started in North Brooklyn and grew into Western Queens. */
const boroughs = [
  { name: "Brooklyn", neighborhoods: brooklyn },
  { name: "Queens", neighborhoods: queens },
];

const marquee = boroughs.flatMap((borough) => borough.neighborhoods.map((item) => item.name)).join(" · ");

function HomePage() {
  return (
    <Shell bare toolbar={false}>
      <Navbar variant="hero" brand={<BrandLockup logoVariant="white" compact />} links={links} action={<a href={JOIN_URL} className={buttonVariants({ variant: "white" })}>Join the collective</a>} />
      <Hero
        image={hero}
        imageAlt="Woman standing in a field beneath an open sky"
        badge="Brooklyn & Queens, New York"
        title="Find Your People. Help Someone Else Shine."
        description="For women building businesses, careers, creative work, and real relationships close to home."
        info={{ image: event, text: "A generous, engaged community across Brooklyn and Queens." }}
        highlight={{ value: "10", label: "Neighborhoods" }}
      />

      <Section id="mission" className="pt-12">
        <Container className="flex flex-col items-center gap-10 text-center">
          <Badge>Our mission</Badge>
          <Statement lead={4} text="The Women’s Collective brings women across Brooklyn and Queens together to meet, share knowledge, support one another’s work, and build real relationships close to home." />
          <Text size="lg" className="max-w-3xl">When women know who is around them, they can recommend each other, collaborate, show up for each other’s events, and create opportunities that would be harder to build alone.</Text>
          <a href={JOIN_URL} className={buttonVariants()}>Introduce yourself</a>
        </Container>
      </Section>

      <Section className="bg-surface">
        <Container className="flex flex-col gap-12">
          <div className="flex flex-col items-center justify-between gap-8 text-center md:flex-row md:text-left">
            <SectionHeader align="start" badge="Meet the collective" title="Women Doing Remarkable Work Nearby" intro="Discover the people, practices, and ideas taking shape across Brooklyn and Queens." />
            <Link to="/members" className={buttonVariants({ variant: "outline" })}>Explore all members</Link>
          </div>
          <figure className="flex flex-col gap-5">
            <ImageFrame src={event} alt="Members talking at a rooftop evening event" shape="panel" ratio="auto" width={1280} height={1024} className="aspect-[4/3] md:aspect-[21/9]" style={{ objectPosition: "50% 30%" }} />
            <figcaption className="text-center text-lg text-ink-muted md:text-left">Members meet in person across Brooklyn and Queens to share their work, swap referrals, and get to know the women nearby.</figcaption>
          </figure>
        </Container>
      </Section>

      <Section id="take-part">
        <Container className="flex flex-col gap-16">
          <SectionHeader badge="Inside the collective" title="Connections That Move Work Forward" intro="Not networking for networking’s sake. This is a place to build genuine relationships and support women-owned work." />
          <div className="grid gap-3 md:grid-cols-3">
            <FeatureCard tag="01" title="Share What You Do" description="Introduce your business, work, or project and help neighbors understand what you bring." className="bg-mint" />
            <FeatureCard variant="photo" image={event} title="Find Collaborators" description="Build partnerships, exchange referrals, and discover opportunities through people nearby." />
            <FeatureCard tag="03" title="Show Up Locally" description="Promote women-owned businesses and learn about gatherings, events, and meetups across Brooklyn and Queens." className="bg-lilac" />
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
          <div className="flex flex-col gap-14">
            {boroughs.map((borough) => (
              <div key={borough.name} role="group" aria-labelledby={`borough-${borough.name.toLowerCase()}`} className="flex flex-col gap-6">
                <div className="flex items-center gap-5">
                  <span aria-hidden className="h-px flex-1 bg-white/25" />
                  <p id={`borough-${borough.name.toLowerCase()}`} className="font-display text-3xl md:text-4xl">{borough.name}</p>
                  <span aria-hidden className="h-px flex-1 bg-white/25" />
                </div>
                {/* Flex-wrap instead of grid so each group's last row sits centred. */}
                <div className="flex flex-wrap justify-center gap-3">
                  {borough.neighborhoods.map((item) => (
                    <article key={item.name} className="group motion-scroll-reveal relative flex min-h-72 w-full overflow-hidden rounded-card text-white sm:w-[calc(50%-0.375rem)] lg:w-[calc(25%-0.5625rem)]">
                      <img src={item.image} alt={`${item.name}, ${borough.name}`} loading="lazy" width={768} height={768} className="absolute inset-0 size-full object-cover transition-transform duration-slow ease-gentle group-hover:scale-105" />
                      <div className={`absolute inset-0 bg-gradient-to-t ${item.overlay} to-transparent`} aria-hidden />
                      <div className="relative z-10 flex w-full flex-col justify-between p-6">
                        <ConstellationLogo variant={item.logo} size="sm" className="brightness-0 invert" aria-hidden alt="" />
                        <h3 className="font-display text-3xl">{item.name}</h3>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Split media={<ImageFrame src={natasa} alt="Nataša Tuohy, founder of The Women’s Collective" shape="panel" ratio="square" />}>
            <Badge variant="solid">Founder</Badge>
            <Heading as="h3" size="section">Meet Nataša Tuohy</Heading>
            <Text size="lg">Nataša is a New York–based architectural and interior designer whose work brings European sensibility together with New York pragmatism. Educated at the University of Florence, she founded her Greenpoint studio around thoughtful spaces, trusted collaboration, and enduring relationships.</Text>
            <a href="https://natasatuohy.com/about/" target="_blank" rel="noreferrer" className={buttonVariants({ variant: "white" })}>Visit Nataša’s studio</a>
          </Split>
        </Container>
      </Section>

      <div className="overflow-hidden"><Ribbon text={marquee} /></div>

      <Section className="bg-paper">
        <Container className="flex flex-col items-center gap-10 text-center">
          <SectionHeader badge="Membership" title="There Is Room in This Constellation" intro="The application helps us learn about you, your work, and how you would like to participate in the community." />
          <a href={JOIN_URL} className={buttonVariants({ variant: "primary", size: "lg" })}>Start your application</a>
        </Container>
      </Section>

      <Section>
        <Container width="narrow" className="flex flex-col gap-14">
          <SectionHeader badge="A collective for Brooklyn and Queens" title="Come As You Are" />
          <Accordion items={[
            { question: "Who is the collective for?", answer: "Women founders, entrepreneurs, creatives, freelancers, professionals, and neighbors who want to contribute to a generous, engaged community." },
            { question: "Which neighborhoods are included?", answer: "We started in Greenpoint, Williamsburg and Bushwick in North Brooklyn and have grown into Western Queens: Long Island City, Astoria, Sunnyside, Jackson Heights, Elmhurst, Forest Hills and Rego Park. If you live or work nearby, you’re welcome." },
            { question: "Is the community inclusive?", answer: "Yes. We welcome women from all backgrounds, including moms, married and single women, LGBTQ+ members, non-binary people who feel aligned with the community, immigrants, international members, and people from diverse cultures." },
          ]} />
        </Container>
      </Section>

      <Footer
        brand={<BrandLockup logoVariant="white" />}
        statement="Find your people, share what you do, and help someone else shine."
        links={[{ label: "Our mission", href: "#mission" }, { label: "Members", href: "/members" }, { label: "Join", href: JOIN_URL }]}
        note="The Women’s Collective · Brooklyn & Queens"
      />
    </Shell>
  );
}