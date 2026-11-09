import { createFileRoute } from "@tanstack/react-router";
import { AppPage } from "@/app/layout/AppLayout";
import { AppShell, TopBar } from "@/app/layout/AppShell";
import { FormResponsesPanel, MembershipFormsPanel } from "@/features/admin/panels";

// `admin_` un-nests it from /admin's page while keeping the `_admin` guard; every read and write is requireAdmin too.
export const Route = createFileRoute("/_authenticated/_admin/admin_/forms")({
  head: () => ({
    meta: [
      { title: "Forms — The Women’s Collective" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FormsPage,
});

/** The forms section: custom /f/… forms (build, open/close, answers, CSV) and the join & review switches. */
function FormsPage() {
  const { user } = Route.useRouteContext();
  return (
    <AppPage>
      <AppShell page="/admin/forms" admin>
        <main id="main" tabIndex={-1} className="outline-none">
          <TopBar title="Forms" heading who={{ name: user.name || user.email }} />
          <div className="flex max-w-250 flex-col gap-6 px-4 pt-5 pb-14 sm:px-8 sm:pt-8">
            <p className="text-[15px] text-app-muted">Build forms at /f/…, open or close them, read their answers and download them as CSV, and open or close the join and review forms.</p>
            <FormResponsesPanel />
            <MembershipFormsPanel />
          </div>
        </main>
      </AppShell>
    </AppPage>
  );
}
