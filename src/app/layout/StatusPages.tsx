// The live site's 404 and error pages, wired as the router defaults in `src/router.tsx`.
import * as React from "react";
import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Button, Container, Section, SectionHeader, buttonVariants } from "@/index";
import { AppNav, AppPage } from "./AppLayout";

const links = [
  { label: "Our mission", href: "/#mission" },
  { label: "Members", href: "/members" },
  { label: "Join", href: "/join" },
];

function StatusPage({ badge, title, intro, actions }: {
  badge: string; title: string; intro: string; actions?: React.ReactNode;
}) {
  return (
    <AppPage>
      <AppNav variant="solid" links={links} />
      <main id="main" tabIndex={-1} className="outline-none">
      <Section className="pt-14 md:pt-20">
        <Container>
          <SectionHeader badge={badge} title={title} intro={intro} />
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {actions}
            <Link to="/" className={buttonVariants({ variant: actions ? "outline" : "primary" })}>Back to home</Link>
          </div>
        </Container>
      </Section>
      </main>
    </AppPage>
  );
}

export function NotFound() {
  return (
    <StatusPage
      badge="Page not found"
      title="We couldn’t find that page."
      intro="The link may be old, or the page may have moved. Head home and find your people from there."
    />
  );
}

export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  React.useEffect(() => {
    console.error("[route] render failed", error);
  }, [error]);
  return (
    <StatusPage
      badge="Something went wrong"
      title="That page didn’t load."
      intro="Something on our side tripped up. Try again, or head home and pick up from there."
      actions={(
        <Button
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          Try again
        </Button>
      )}
    />
  );
}
