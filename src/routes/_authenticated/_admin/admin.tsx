import { createFileRoute } from "@tanstack/react-router";
import { AppPage } from "@/app/layout/AppLayout";
import { AppShell, TopBar } from "@/app/layout/AppShell";
import { ApplicationsPanel, BookingsPanel, InboxPanel, GatheringsPanel, MembersPanel, NeighborhoodsPanel } from "@/features/admin/panels";

export const Route = createFileRoute("/_authenticated/_admin/admin")({
  head: () => ({
    meta: [
      { title: "Admin — The Women’s Collective" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

/** The six admin cards on one page; the sidebar's Admin group anchors each. The `_admin` guard only lets admins in. */
function AdminPage() {
  const { user } = Route.useRouteContext();
  return (
    <AppPage>
      <AppShell page="/admin" admin>
        <main id="main" tabIndex={-1} className="outline-none">
          <TopBar title="Admin" heading who={{ name: user.name || user.email }} />
          <div className="flex max-w-250 flex-col gap-6 px-4 pt-5 pb-14 sm:px-8 sm:pt-8">
            <p className="text-[15px] text-app-muted">Answer messages, review applications, welcome members, shape neighborhoods, confirm headshot sessions and put gatherings on the calendar.</p>
            <InboxPanel />
            <ApplicationsPanel />
            <MembersPanel />
            <NeighborhoodsPanel />
            <BookingsPanel />
            <GatheringsPanel />
          </div>
        </main>
      </AppShell>
    </AppPage>
  );
}
