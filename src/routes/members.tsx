import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Container,
  Heading,
  MemberCard,
  Section,
  Text,
  buttonVariants,
  cn,
} from "@/index";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { useNeighborhoods } from "@/features/neighborhoods/queries";
import { pickerNames } from "@/features/neighborhoods/options";
import { toneFor } from "@/features/neighborhoods/tone";
import { directoryQuery, publicProfilesQuery, viewerQuery } from "@/features/members/queries";

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

function MembersPage() {
  const [activeNeighborhood, setActiveNeighborhood] = React.useState<string>("All");
  const { data: hoodList = [] } = useNeighborhoods();
  const viewer = useQuery(viewerQuery);
  // Admins read the directory like approved members (public_directory() admits both).
  const member = viewer.data?.member === true || viewer.data?.admin === true;
  // Two audiences (§2.10): approved members get the full directory; everyone else, opted-in public cards.
  const directory = useQuery({ ...directoryQuery, enabled: member });
  const publicCards = useQuery({ ...publicProfilesQuery, enabled: viewer.isSuccess && !member });
  const list = member ? directory : publicCards;
  const all = list.data ?? [];
  const audience = member ? "member" : viewer.data?.signedIn ? "pending" : "visitor";
  // A filter chosen in one audience can match nothing in the other.
  React.useEffect(() => setActiveNeighborhood("All"), [audience]);
  // Active neighborhoods in DB order, plus any a listed member still uses (e.g. one an admin deactivated).
  const neighborhoods = ["All", ...pickerNames(hoodList, all.map((m) => m.neighborhood))];
  const members = activeNeighborhood === "All"
    ? all
    : all.filter((m) => m.neighborhood === activeNeighborhood);
  const loading = viewer.isPending || (!viewer.isError && list.isPending);
  const failed = viewer.isError || list.isError;
  const retry = () => void (viewer.isError ? viewer.refetch() : list.refetch());

  return (
    <AppPage>
      <AppNav
        links={[{ label: "Home", href: "/" }, { label: "Members", href: "/members" }, { label: "Join", href: "/join" }, { label: viewer.data?.signedIn ? "Profile" : "Sign in", href: viewer.data?.signedIn ? "/account" : "/auth" }]}
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
        {viewer.isSuccess && audience !== "member" && (
          <div className="bg-sun py-3 text-center text-sm text-sun-ink">
            {audience === "visitor"
              ? <>Showing members who share their profile publicly. <Link to="/auth" className="underline underline-offset-4">Sign in to see the full directory</Link></>
              : "Showing members who share their profile publicly. Your directory unlocks once you’re welcomed in."}
          </div>
        )}
      </header>

      <Section tone="night" className="rounded-dome pt-24 md:pt-32">
        <Container className="flex flex-col gap-12">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6 border-b border-line pb-8">
            <div className="min-w-0">
              <Badge variant="solid">The directory</Badge>
              <Heading as="h2" className="mt-5 max-w-2xl">A Catalogue of Women Building Nearby</Heading>
            </div>
            <p aria-live="polite" className="shrink-0 pb-1 text-sm text-ink-muted">{list.isSuccess && `${String(members.length).padStart(2, "0")} profiles`}</p>
          </div>

          <div className="flex flex-col gap-5">
            <p className="text-xs font-medium uppercase text-ink-muted">Browse by neighborhood</p>
            <div className="flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Filter members by neighborhood">
              {neighborhoods.map((neighborhood) => {
                const selected = activeNeighborhood === neighborhood;
                const color = selected ? toneFor(neighborhood, hoodList)?.color : undefined;
                return (
                  <Button
                    key={neighborhood}
                    type="button"
                    size="sm"
                    variant={selected ? "white" : "outline"}
                    className={cn("shrink-0", color && "bg-(--hood) hover:bg-(--hood)")}
                    style={color ? ({ "--hood": color } as React.CSSProperties) : undefined}
                    aria-pressed={selected}
                    onClick={() => setActiveNeighborhood(neighborhood)}
                  >
                    {neighborhood}
                  </Button>
                );
              })}
            </div>
          </div>

          {failed && (
            <div role="alert" className="flex flex-wrap items-center gap-4 text-sm text-ink-muted">
              <p>We couldn’t load the member directory right now.</p>
              <Button type="button" size="sm" variant="outline" onClick={retry}>Retry</Button>
            </div>
          )}

          {loading ? (
            <p role="status" className="text-sm text-ink-muted">Loading members…</p>
          ) : list.isSuccess && all.length === 0 ? (
            <div className="flex max-w-xl flex-col gap-3 border-t border-line pt-8">
              <p className="font-display text-2xl">{audience === "member" ? "No members are listed yet." : "No one has shared a public profile yet."}</p>
              <p className="text-sm text-ink-muted">
                {audience === "member"
                  ? "Switch on “Show me in the member directory” on your profile and you’ll be the first neighbor here."
                  : "Members choose whether their card appears on the public website. Check back soon."}
              </p>
            </div>
          ) : (
            members.length === 0 ? (
              <p className="text-sm text-ink-muted">No one from {activeNeighborhood} here yet.</p>
            ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {members.map((m) => <MemberCard key={m.id} member={m} variant="catalogue" tone={toneFor(m.neighborhood, hoodList)} catalogueNumber={m.catalogueNumber} />)}
            </div>
            )
          )}
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

      <AppFooter links={[{ label: "Home", href: "/" }, { label: "Join", href: "/join" }]} />
    </AppPage>
  );
}