import { createFileRoute, Link } from "@tanstack/react-router";
import { AppPage } from "@/app/layout/AppLayout";
import { AppShell, TopBar } from "@/app/layout/AppShell";
import { linkClass } from "@/app/layout/app-classes";
import { Card } from "@/app/layout/app-ui";
import { useAdminBusiness } from "@/features/cal/admin-state";
import { EventEditorForm } from "@/features/cal/admin-ui";

export const Route = createFileRoute("/_authenticated/_admin/admin_/events/new")({
  head: () => ({ meta: [{ title: "New event — Admin — The Women’s Collective" }, { name: "robots", content: "noindex" }] }),
  component: NewGathering,
});

function NewGathering() {
  const { user } = Route.useRouteContext();
  const [business] = useAdminBusiness();
  return (
    <AppPage trail={false}>
      <AppShell page="/admin/events">
        <main id="main" tabIndex={-1} className="outline-none">
          <TopBar title="New event" heading who={{ name: user.name || user.email }} />
          <div className="flex max-w-250 flex-col gap-6 px-4 pt-5 pb-14 sm:px-8 sm:pt-8">
            <Link to="/admin/$section" params={{ section: "events" }} className={linkClass}>Back to events</Link>
            <Card title="Details"><EventEditorForm business={business} /></Card>
          </div>
        </main>
      </AppShell>
    </AppPage>
  );
}
