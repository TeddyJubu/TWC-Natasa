import * as React from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { AppPage } from "@/app/layout/AppLayout";
import { AppShell, TopBar } from "@/app/layout/AppShell";
import { isAdminSection, sectionItem, type AdminSection } from "@/app/layout/shell-nav";
import {
  ActivityPanel, AdminSearch, ApplicationsPanel, BookingsPanel, InboxPanel, MemberReviewsPanel, MembersPanel,
  NeighborhoodsPanel, NewsletterPanel, SpotlightPanel,
} from "@/features/admin/panels";
import { ensureCoverPolicy } from "@/app/cover-pages";
import { AppointmentsPanel, GatheringsPanel } from "@/features/cal/admin-ui";

/** Each admin section's page: its one-line purpose, its card, and a search box for the cards that filter by one. */
const PAGES: Record<AdminSection, { intro: string; Panel: React.ComponentType<{ query?: string }>; search?: boolean }> = {
  inbox: { intro: "Contact messages and partnership inquiries. Archive one once it’s answered.", Panel: InboxPanel, search: true },
  applications: { intro: "Everyone who has asked to join. Approve or decline, add notes, and download the list.", Panel: ApplicationsPanel, search: true },
  reviews: { intro: "Members’ answers to their review links. Apply what they ask on their profile, then mark it handled.", Panel: MemberReviewsPanel },
  bookings: { intro: "Headshot sessions members have asked for. Confirm or decline each one.", Panel: BookingsPanel },
  members: { intro: "Every member profile: approve or decline, fix a neighborhood, send a review or Spotlight link.", Panel: MembersPanel, search: true },
  newsletter: { intro: "Who is on the newsletter list. Read-only here; Beehiiv holds the list itself.", Panel: NewsletterPanel, search: true },
  spotlight: { intro: "Answers to the weekly Spotlight, sent and imported.", Panel: SpotlightPanel },
  events: { intro: "The calendar, kept in Cal: add an event, change or cancel it, and see who’s coming.", Panel: GatheringsPanel },
  appointments: { intro: "Bookable appointments in Cal: who has booked, and the types people can book.", Panel: AppointmentsPanel },
  neighborhoods: { intro: "The neighborhoods members choose from, with their colours and logos.", Panel: NeighborhoodsPanel },
  activity: { intro: "Who approved, declined, noted or moved whom, newest first. It can’t be edited.", Panel: ActivityPanel },
};

// `admin_` un-nests it from /admin's page while keeping the `_admin` guard; /admin/forms is a static route, so it wins.
export const Route = createFileRoute("/_authenticated/_admin/admin_/$section")({
  beforeLoad: ({ params, location, preload }) => {
    if (!isAdminSection(params.section)) throw notFound();
    return params.section === "events" ? ensureCoverPolicy(location.href, preload) : undefined;
  },
  head: ({ params }) => ({
    meta: [
      { title: `${isAdminSection(params.section) ? sectionItem(params.section).label : "Admin"} — Admin — The Women’s Collective` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SectionPage,
});

function SectionPage() {
  const { user } = Route.useRouteContext();
  const section = Route.useParams().section as AdminSection;
  const { intro, Panel, search } = PAGES[section];
  const [query, setQuery] = React.useState("");
  // The router keeps this page mounted from one section to the next: start each one with an empty search.
  React.useEffect(() => { setQuery(""); }, [section]);
  return (
    <AppPage trail={false}>
      <AppShell page={`/admin/${section}`} admin>
        <main id="main" tabIndex={-1} className="outline-none">
          <TopBar title={sectionItem(section).label} heading who={{ name: user.name || user.email }} />
          <div className="flex max-w-250 flex-col gap-6 px-4 pt-5 pb-14 sm:px-8 sm:pt-8">
            <p className="text-[15px] text-app-muted">{intro}</p>
            {search && <AdminSearch value={query} onChange={setQuery} label={`Search ${sectionItem(section).label.toLowerCase()}`} />}
            <Panel key={section} query={query} />
          </div>
        </main>
      </AppShell>
    </AppPage>
  );
}
