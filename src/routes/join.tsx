import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Container, Section, buttonVariants } from "@/index";
import { AppNav, AppPage } from "@/app/layout/AppLayout";
import { ApplicationForm } from "@/features/applications/ApplicationForm";
import { useSubmitApplication } from "@/features/applications/mutations";
import { applicantQuery } from "@/features/applications/queries";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join The Women’s Collective — Membership application" },
      { name: "description", content: "Apply to The Women’s Collective, a community connecting women across Western Queens." },
      { property: "og:title", content: "Join The Women’s Collective — Membership application" },
      { property: "og:description", content: "Tell us about you, your work, and how you hope to take part in our Western Queens community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { mutateAsync: submit } = useSubmitApplication();
  // Prefill is a convenience: while it loads, or if it fails, the form simply starts empty.
  const { data: applicant } = useQuery(applicantQuery);
  return (
    <AppPage>
      <AppNav
        variant="solid"
        links={[{ label: "Our mission", href: "/#mission" }, { label: "Our constellation", href: "/#constellation" }]}
        action={<Link to="/" className={buttonVariants({ variant: "outline", size: "sm" })}>Back to home</Link>}
      />
      <main id="main" tabIndex={-1} className="outline-none">
      <Section className="pt-14 md:pt-20">
        <Container>
          <div className="overflow-hidden rounded-panel border border-line shadow-soft">
            <ApplicationForm submit={submit} initial={applicant ?? undefined} />
          </div>
        </Container>
      </Section>
      </main>
    </AppPage>
  );
}
