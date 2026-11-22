import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppPage } from "@/app/layout/AppLayout";
import { AppShell, TopBar } from "@/app/layout/AppShell";
import { isAdminSection } from "@/app/layout/shell-nav";
import { AdminOverview } from "@/features/admin/panels";

export const Route = createFileRoute("/_authenticated/_admin/admin")({
  head: () => ({
    meta: [
      { title: "Admin — The Women’s Collective" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

/**
 * The overview: what waits on you, then every other area, each opening its own page (/admin/<section>). The `_admin`
 * guard only lets admins in. An old /admin#<card> link (alert emails, bookmarks) forwards to that card's page; the
 * hash never reaches the server, so this happens here.
 */
function AdminPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  React.useEffect(() => {
    const raw = window.location.hash.slice(1);
    const hash = raw === "gatherings" ? "events" : raw; // the section's old name, in sent emails
    if (isAdminSection(hash)) void navigate({ to: "/admin/$section", params: { section: hash }, replace: true });
  }, [navigate]);
  return (
    <AppPage trail={false}>
      <AppShell page="/admin" admin>
        <main id="main" tabIndex={-1} className="outline-none">
          <TopBar title="Admin" heading who={{ name: user.name || user.email }} />
          <div className="flex max-w-250 flex-col gap-6 px-4 pt-5 pb-14 sm:px-8 sm:pt-8">
            <AdminOverview />
          </div>
        </main>
      </AppShell>
    </AppPage>
  );
}
