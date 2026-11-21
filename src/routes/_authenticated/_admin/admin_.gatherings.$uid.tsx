import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ensureCoverPolicy } from "@/app/cover-pages";
import { AppPage } from "@/app/layout/AppLayout";
import { AppShell, TopBar } from "@/app/layout/AppShell";
import { linkClass } from "@/app/layout/app-classes";
import { Card, InlineError } from "@/app/layout/app-ui";
import { useAdminBusiness } from "@/features/cal/admin-state";
import { CancelEventDialog, EventEditorForm, PublicLinkCopy, RsvpTable } from "@/features/cal/admin-ui";
import { adminCalEventQuery } from "@/features/cal/queries";

export const Route = createFileRoute("/_authenticated/_admin/admin_/gatherings/$uid")({
  beforeLoad: ({ location, preload }) => ensureCoverPolicy(location.href, preload),
  head: () => ({ meta: [{ title: "Event — Admin — The Women’s Collective" }, { name: "robots", content: "noindex" }] }),
  component: EditGathering,
});

function EditGathering() {
  const { user } = Route.useRouteContext();
  const { uid } = Route.useParams();
  const [business] = useAdminBusiness();
  const query = useQuery({ ...adminCalEventQuery(uid, business), retry: false });
  const event = query.data;
  return (
    <AppPage trail={false}>
      <AppShell page="/admin/gatherings" admin>
        <main id="main" tabIndex={-1} className="outline-none">
          <TopBar title={event?.title ?? "Event"} heading who={{ name: user.name || user.email }} />
          <div className="flex max-w-250 flex-col gap-6 px-4 pt-5 pb-14 sm:px-8 sm:pt-8">
            <Link to="/admin/$section" params={{ section: "gatherings" }} className={linkClass}>Back to events</Link>
            {query.isError ? <InlineError message={(query.error as Error).message || "The calendar isn’t responding."} onRetry={() => void query.refetch()} />
              : !event ? <p role="status" className="text-sm text-app-muted">Loading…</p>
              : (
                <>
                  <div className="flex flex-wrap gap-2"><PublicLinkCopy slug={event.slug} /><CancelEventDialog event={event} business={business} /></div>
                  <RsvpTable event={event} business={business} />
                  <Card title="Details"><EventEditorForm key={`${event.uid}:${event.slug}`} event={event} business={business} /></Card>
                </>
              )}
          </div>
        </main>
      </AppShell>
    </AppPage>
  );
}
