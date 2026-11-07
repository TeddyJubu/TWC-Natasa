import { createFileRoute } from "@tanstack/react-router";
import { Container, Section, SectionHeader, Tabs } from "@/index";
import { AppNav, AppPage } from "@/app/layout/AppLayout";
import { ApplicationsPanel, BookingsPanel, MembersPanel, NeighborhoodsPanel } from "@/features/admin/panels";

export const Route = createFileRoute("/_authenticated/_admin/admin")({
  head: () => ({
    meta: [
      { title: "Admin — The Women’s Collective" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const TABS = [
  { label: "Applications", content: <ApplicationsPanel /> },
  { label: "Members", content: <MembersPanel /> },
  { label: "Neighborhoods", content: <NeighborhoodsPanel /> },
  { label: "Bookings", content: <BookingsPanel /> },
];

// Four serif labels don't fit four equal columns at phone width. Below md the tab list becomes a scrolling row
// of smaller labels (still 24px: idle ink-faint tabs need large text for 3:1) (display:flex sidesteps the component's inline grid columns); from md up the
// design-system defaults apply again. The Tabs component itself is untouched.
const PHONE_TABS = [
  "[&_[role=tablist]]:flex [&_[role=tablist]]:gap-8 [&_[role=tablist]]:overflow-x-auto md:[&_[role=tablist]]:grid md:[&_[role=tablist]]:gap-0",
  "[&_[role=tab]]:mb-0 [&_[role=tab]]:shrink-0 [&_[role=tab]]:whitespace-nowrap [&_[role=tab]]:pb-5 [&_[role=tab]]:text-2xl",
  "md:[&_[role=tab]]:-mb-px md:[&_[role=tab]]:pb-10 md:[&_[role=tab]]:text-3xl",
].join(" ");

function AdminPage() {
  return (
    <AppPage>
      <AppNav
        links={[
          { label: "Home", href: "/" }, { label: "Members", href: "/members" },
          { label: "Profile", href: "/account" }, { label: "Admin", href: "/admin" },
        ]}
      />
      <main id="main" tabIndex={-1} className="outline-none">
      <Section>
        <Container className="flex flex-col gap-16">
          <SectionHeader
            badge="Admin"
            title="Tend the Constellation"
            intro="Review applications, welcome members, shape neighborhoods and confirm headshot sessions."
          />
          <Tabs items={TABS} className={PHONE_TABS} />
        </Container>
      </Section>
      </main>
    </AppPage>
  );
}
