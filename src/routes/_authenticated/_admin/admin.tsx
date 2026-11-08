import { createFileRoute } from "@tanstack/react-router";
import { AppPage } from "@/app/layout/AppLayout";
import { AppShell, TopBar } from "@/app/layout/AppShell";
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

/** The four admin cards on one page; the sidebar's Admin group anchors each. The `_admin` guard only lets admins in. */
function AdminPage() {
  return (
    <AppPage>
      <AppShell page="/admin" admin>
        <main id="main" tabIndex={-1} className="outline-none">
          <TopBar section="Collective" icon="shield-check" title="Admin" heading />
          <div className="flex max-w-277 flex-col gap-6 px-4 pt-6 pb-14 sm:px-8 lg:px-12 lg:pt-9">
            <p className="text-[15px] text-app-muted">Review applications, welcome members, shape neighborhoods and confirm headshot sessions.</p>
            <ApplicationsPanel />
            <MembersPanel />
            <NeighborhoodsPanel />
            <BookingsPanel />
          </div>
        </main>
      </AppShell>
    </AppPage>
  );
}
