import { Link, createFileRoute } from "@tanstack/react-router";
import { Container, Navbar, Section, Wordmark, buttonVariants } from "@/index";
import { Shell } from "@/showcase/Shell";
import { MembershipApplication } from "@/showcase/MembershipApplication";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join Bloom — Membership application" },
      { name: "description", content: "Apply to the circle: a ten-section membership application with clear consent steps and space for your story." },
      { property: "og:title", content: "Join Bloom — Membership application" },
      { property: "og:description", content: "A ten-section membership application — answer each part at your own pace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  return (
    <Shell bare>
      <Navbar
        variant="solid"
        brand={<Link to="/" className="hover:opacity-70 transition-opacity" aria-label="Back to the sample page"><Wordmark>Bloom</Wordmark></Link>}
        links={[{ label: "Sample page", href: "/" }]}
        action={<Link to="/" className={buttonVariants({ variant: "outline", size: "sm" })}>Back to home</Link>}
      />
      <Section className="pt-14 md:pt-20">
        <Container>
          <div className="overflow-hidden rounded-panel border border-line shadow-soft">
            <MembershipApplication />
          </div>
        </Container>
      </Section>
    </Shell>
  );
}
