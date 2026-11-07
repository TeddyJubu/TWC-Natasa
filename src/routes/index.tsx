import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Accordion, Badge, ConstellationLogo, Container, FeatureCard,
  CurvedGallery, Heading, Hero, ImageFrame, Ribbon, Section, SectionHeader, Split, Statement, Text, buttonVariants, cn, type ConstellationLogoProps,
} from "@/index";
import { useQuery } from "@tanstack/react-query";
import { publicProfilesQuery } from "@/features/members/queries";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import hero from "@/assets/photography/hero.jpg";
import event from "@/assets/photography/event.jpg";
import neighborhoodLic from "@/assets/photography/neighborhood-lic.jpg";
import neighborhoodSunnyside from "@/assets/photography/neighborhood-sunnyside.jpg";
import neighborhoodAstoria from "@/assets/photography/neighborhood-astoria.jpg";
import neighborhoodJacksonHeights from "@/assets/photography/neighborhood-jackson-heights.jpg";
import neighborhoodElmhurst from "@/assets/photography/neighborhood-elmhurst.jpg";
import neighborhoodForestHills from "@/assets/photography/neighborhood-forest-hills.jpg";
import neighborhoodRegoPark from "@/assets/photography/neighborhood-rego-park.jpg";
import natasa from "@/assets/photography/natasa-tuohy.jpg";

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
  { label: "Members", href: "/members" },
  { label: "Our constellation", href: "#constellation" },
  { label: "Take part", href: "#take-part" },
  { label: "Join", href: "/join" },
  { label: "Sign in", href: "/account" },
];

// `dark`: black title on the light hues, where white falls under 3:1 (T26).
const neighborhoods: { name: string; image: string; overlay: string; logo: ConstellationLogoProps["variant"]; dark?: boolean }[] = [
  { name: "Long Island City", image: neighborhoodLic, overlay: "from-lic via-lic/55", dark: true, logo: "long-island-city" },
  { name: "Sunnyside", image: neighborhoodSunnyside, overlay: "from-sunnyside via-sunnyside/55", logo: "sunnyside" },
  { name: "Astoria", image: neighborhoodAstoria, overlay: "from-astoria via-astoria/55", dark: true, logo: "astoria" },
  { name: "Jackson Heights", image: neighborhoodJacksonHeights, overlay: "from-jackson-heights via-jackson-heights/55", logo: "jackson-heights" },
  { name: "Elmhurst", image: neighborhoodElmhurst, overlay: "from-elmhurst via-elmhurst/55", dark: true, logo: "elmhurst" },
  { name: "Forest Hills", image: neighborhoodForestHills, overlay: "from-forest-hills via-forest-hills/55", dark: true, logo: "forest-hills" },
  { name: "Rego Park", image: neighborhoodRegoPark, overlay: "from-rego-park via-rego-park/55", logo: "rego-park" },
];

function HomePage() {
  // Only members who opted in (§2.10). Loading, empty or failed: the section stands without a gallery.
  // Cards without a portrait fall back to the hero photo; never present that as a member.
  const publicCards = (useQuery(publicProfilesQuery).data ?? []).filter((m) => m.image !== hero);
  return (
    <AppPage>
      <AppNav variant="hero" links={links} action={<Link to="/join" className={buttonVariants({ variant: "white" })}>Join the collective</Link>} />
      <Hero
        image={hero}
        imageAlt="Woman standing in a field beneath an open sky"
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

      <Section className="bg-surface">
        <Container>
          <div className="flex flex-col items-center justify-between gap-8 text-center md:flex-row md:text-left">
            <SectionHeader align="start" badge="Meet the collective" title="Women Doing Remarkable Work Nearby" intro="Discover the people, practices, and ideas taking shape across Queens." />
            <Link to="/members" className={buttonVariants({ variant: "outline" })}>Explore all members</Link>
          </div>
        </Container>
        {publicCards.length > 0 && (
          <CurvedGallery
            className="mt-8 md:mt-4"
            images={publicCards.map((member) => ({
              src: member.image,
              alt: [member.name, member.business].filter(Boolean).join(" · "),
            }))}
          />
        )}
        <Container className={publicCards.length ? "flex flex-col items-center gap-5" : "mt-8 flex flex-col items-center gap-5"}>
          <Link to="/members" className={buttonVariants({ variant: "ink" })}>View the member directory</Link>
        </Container>
      </Section>

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
              <article key={item.name} className="group motion-scroll-reveal relative flex min-h-72 overflow-hidden rounded-card text-white">
                <img src={item.image} alt={`${item.name}, Queens`} loading="lazy" width={768} height={768} className="absolute inset-0 size-full object-cover transition-transform duration-slow ease-gentle group-hover:scale-105" />
                <div className={`absolute inset-0 bg-gradient-to-t ${item.overlay} to-transparent`} aria-hidden />
                <div className="relative z-10 flex w-full flex-col justify-between p-6">
                  <ConstellationLogo variant={item.logo} size="sm" className={item.dark ? "brightness-0" : "brightness-0 invert"} aria-hidden alt="" />
                  <h3 className={cn("font-display text-3xl", item.dark && "text-black")}>{item.name}</h3>
                </div>
              </article>
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

      <AppFooter links={[{ label: "Our mission", href: "#mission" }, { label: "Members", href: "/members" }, { label: "Join", href: "/join" }, { label: "Sign in", href: "/account" }]} />
    </AppPage>
  );
}