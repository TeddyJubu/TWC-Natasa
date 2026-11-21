import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ensureCoverPolicy } from "@/app/cover-pages";
import { EventsSkeleton, EventsWidget } from "@/features/cal/events-ui";
import { calEventsQuery } from "@/features/cal/queries";
import type { EventList } from "@/features/cal/types";
import { ErrorBanner } from "@/features/cal/ui";

type Search = { category?: string; business?: string };
const params = (s: Search) => ({ tab: "upcoming" as const, take: 5, ...s });

// A bare list for framing. The CSP's frame-ancestors stays 'self' until a partner site is named.
export const Route = createFileRoute("/embed/gatherings")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    ...(typeof raw.category === "string" && raw.category ? { category: raw.category.slice(0, 80) } : {}),
    ...(typeof raw.business === "string" && raw.business ? { business: raw.business.slice(0, 80) } : {}),
  }),
  beforeLoad: ({ location, preload }) => ensureCoverPolicy(location.href, preload),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }): Promise<EventList | undefined> =>
    context.queryClient.ensureQueryData(calEventsQuery(params(deps))).catch(() => undefined),
  head: () => ({ meta: [{ title: "Events — The Women’s Collective" }, { name: "robots", content: "noindex" }] }),
  component: EmbedGatherings,
});

function EmbedGatherings() {
  const search = Route.useSearch();
  const query = useQuery({ ...calEventsQuery(params(search)), initialData: Route.useLoaderData() });
  return (
    <main id="main" tabIndex={-1} className="bg-sb-paper p-4 text-sb-ink outline-none">
      <h1 className="twc-h3 mb-3">Coming up</h1>
      {query.data ? <EventsWidget events={query.data.events} />
        : query.isError ? <ErrorBanner message="We couldn’t load the calendar right now." onRetry={() => void query.refetch()} />
        : <EventsSkeleton />}
    </main>
  );
}
