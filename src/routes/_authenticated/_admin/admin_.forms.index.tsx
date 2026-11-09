import { createFileRoute } from "@tanstack/react-router";
import { AppPage } from "@/app/layout/AppLayout";
import { AppShell, TopBar } from "@/app/layout/AppShell";
import { FormsListPanel } from "@/features/admin/panels";

// `admin_` un-nests it from /admin's page while keeping the `_admin` guard; every read and write is requireAdmin too.
export const Route = createFileRoute("/_authenticated/_admin/admin_/forms/")({
  head: () => ({
    meta: [
      { title: "Forms — The Women’s Collective" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FormsPage,
});

/** Every form on its own row: the five built-in ones and your own /f/… forms. Opening one is how you edit it. */
function FormsPage() {
  const { user } = Route.useRouteContext();
  return (
    <AppPage>
      <AppShell page="/admin/forms" admin>
        <main id="main" tabIndex={-1} className="outline-none">
          <TopBar title="Forms" heading who={{ name: user.name || user.email }} />
          <div className="flex max-w-250 flex-col gap-6 px-4 pt-5 pb-14 sm:px-8 sm:pt-8">
            <p className="text-[15px] text-app-muted">Every form on the site, each on its own. Click one to change its wording, open or close it, or read its answers. Add a new one at the bottom.</p>
            <FormsListPanel />
          </div>
        </main>
      </AppShell>
    </AppPage>
  );
}
