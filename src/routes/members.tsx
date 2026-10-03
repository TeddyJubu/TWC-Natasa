import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Badge,
  BrandLockup,
  Button,
  Container,
  Footer,
  Heading,
  MemberCard,
  Navbar,
  Section,
  Text,
  buttonVariants,
} from "@/index";
import { demoMembers } from "@/design-system/data/members";
import { Shell } from "@/showcase/Shell";

export const Route = createFileRoute("/members")({
  head: () => ({
    meta: [
      { title: "Member Directory — The Women’s Collective" },
      { name: "description", content: "Meet a diverse community of women founders, creatives, professionals, and local leaders across Queens." },
      { property: "og:title", content: "Member Directory — The Women’s Collective" },
      { property: "og:description", content: "Discover women doing remarkable work across Queens and the connections they hope to build." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MembersPage,
});

const neighborhoods = ["All", ...Array.from(new Set(demoMembers.map((member) => member.neighborhood)))] as const;

function MembersPage() {
  const [activeNeighborhood, setActiveNeighborhood] = React.useState<string>("All");
  const members = activeNeighborhood === "All"
    ? demoMembers
    : demoMembers.filter((member) => member.neighborhood === activeNeighborhood);

  return (
    <Shell bare>
      <Navbar
        brand={<Link to="/" aria-label="The Women’s Collective home"><BrandLockup compact /></Link>}
        links={[{ label: "Home", href: "/" }, { label: "Members", href: "/members" }, { label: "Join", href: "/join" }]}
        action={<Link to="/join" className={buttonVariants({ variant: "ink", size: "sm" })}>Join<span className="hidden sm:inline"> the collective</span></Link>}
      />

      <header className="overflow-hidden bg-paper pt-20 md:pt-28">
        <Container className="grid gap-14 pb-20 md:grid-cols-[1.35fr_0.65fr] md:items-end md:pb-28">
          <div className="flex flex-col items-start gap-7">
            <Badge>Member directory</Badge>
            <Heading as="h1" size="display" className="max-w-4xl">Meet the Women in Our Constellation</Heading>
          </div>
          <Text size="lg">Founders, makers, strategists, and neighbors sharing what they know—and finding new ways to work together.</Text>
        </Container>
        <div className="bg-sun py-3 text-center text-sm text-sun-ink">These ten profiles are fictional examples created for the design demonstration.</div>
      </header>

      <Section tone="night" className="rounded-dome pt-24 md:pt-32">
        <Container className="flex flex-col gap-12">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6 border-b border-line pb-8">
            <div className="min-w-0">
              <Badge variant="solid">The directory</Badge>
              <Heading as="h2" className="mt-5 max-w-2xl">A Catalogue of Women Building Nearby</Heading>
            </div>
            <p aria-live="polite" className="shrink-0 pb-1 text-sm text-ink-muted">{String(members.length).padStart(2, "0")} profiles</p>
          </div>

          <div className="flex flex-col gap-5">
            <p className="text-xs font-medium uppercase text-ink-muted">Browse by neighborhood</p>
            <div className="flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Filter members by neighborhood">
              {neighborhoods.map((neighborhood) => (
                <Button
                  key={neighborhood}
                  type="button"
                  size="sm"
                  variant={activeNeighborhood === neighborhood ? "white" : "outline"}
                  className="shrink-0"
                  aria-pressed={activeNeighborhood === neighborhood}
                  onClick={() => setActiveNeighborhood(neighborhood)}
                >
                  {neighborhood}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
            {members.map((member, index) => <MemberCard key={member.id} member={member} variant="catalogue" catalogueNumber={index + 1} />)}
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col items-center gap-8 text-center">
          <Badge variant="solid">Add your light</Badge>
          <Heading className="max-w-3xl">Your Work Belongs in the Conversation</Heading>
          <Text className="max-w-xl">Tell us about your work, the people you hope to meet, and how you want to contribute.</Text>
          <Link to="/join" className={buttonVariants({ variant: "white", size: "lg" })}>Start your application</Link>
        </Container>
      </Section>

      <Footer
        brand={<BrandLockup logoVariant="white" />}
        statement="Find your people, share what you do, and help someone else shine."
        links={[{ label: "Home", href: "/" }, { label: "Join", href: "/join" }]}
        note="The Women’s Collective · Western Queens"
      />
    </Shell>
  );
}