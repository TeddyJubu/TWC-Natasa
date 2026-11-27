import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppPage } from "@/app/layout/AppLayout";
import { AppShell, TopBar } from "@/app/layout/AppShell";
import { linkClass } from "@/app/layout/app-classes";
import { Card, InlineError } from "@/app/layout/app-ui";
import { useAdminBusiness } from "@/features/cal/admin-state";
import { EventEditorForm } from "@/features/cal/admin-ui";
import { adminCalEventQuery } from "@/features/cal/queries";

/** `?from=<uid>` makes the new event a copy of that one (Duplicate on an event's page). */
type Search = { from?: string };

export const Route = createFileRoute("/_authenticated/_admin/admin_/events/new")({
  validateSearch: (raw: Record<string, unknown>): Search =>
    typeof raw.from === "string" && /^[\w-]{1,100}$/.test(raw.from) ? { from: raw.from } : {},
  head: () => ({ meta: [{ title: "New event — Admin — The Women’s Collective" }, { name: "robots", content: "noindex" }] }),
  component: NewGathering,
});

function NewGathering() {
  const { user } = Route.useRouteContext();
  const [business] = useAdminBusiness();
  const { from } = Route.useSearch();
  const source = useQuery({ ...adminCalEventQuery(from ?? "", business), enabled: !!from, retry: false });
  return (
    <AppPage trail={false}>
      <AppShell page="/admin/events">
        <main id="main" tabIndex={-1} className="outline-none">
          <TopBar title={from ? "Duplicate event" : "New event"} heading who={{ name: user.name || user.email }} />
          <div className="flex max-w-250 flex-col gap-6 px-4 pt-5 pb-14 sm:px-8 sm:pt-8">
            <Link to="/admin/$section" params={{ section: "events" }} className={linkClass}>Back to events</Link>
            {!from ? <Card title="Details"><EventEditorForm business={business} /></Card>
              : source.isError ? <InlineError message={(source.error as Error).message || "The calendar isn’t responding."} onRetry={() => void source.refetch()} />
              : !source.data ? <p role="status" className="text-sm text-app-muted">Loading…</p>
              : <Card title="Details"><EventEditorForm key={source.data.uid} template={source.data} business={business} /></Card>}
          </div>
        </main>
      </AppShell>
    </AppPage>
  );
}
