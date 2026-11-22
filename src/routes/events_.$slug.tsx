import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ensureCoverPolicy } from "@/app/cover-pages";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { canonicalTags } from "@/app/seo";
import {
  AttendanceSummary, AttendeeList, EventDateTime, EventDescription, EventHero, EventLocation, EventsSkeleton, HostCard, ShareButton,
} from "@/features/cal/events-ui";
import { calEventQuery } from "@/features/cal/queries";
import { RsvpPanel } from "@/features/cal/rsvp";
import { formatRange } from "@/features/cal/time";
import type { CalEventDetail } from "@/features/cal/types";
import { ErrorBanner } from "@/features/cal/ui";

type Search = { business?: string };
const SITE = "The Women’s Collective";

export const Route = createFileRoute("/events_/$slug")({
  validateSearch: (raw: Record<string, unknown>): Search =>
    typeof raw.business === "string" && raw.business ? { business: raw.business.slice(0, 80) } : {},
  beforeLoad: ({ location, preload }) => ensureCoverPolicy(location.href, preload),
  loaderDeps: ({ search }) => ({ business: search.business }),
  loader: async ({ context, params, deps }): Promise<CalEventDetail | null> => {
    try {
      return await context.queryClient.ensureQueryData(calEventQuery(params.slug, deps.business));
    } catch (error) {
      if (/wasn.t found/i.test((error as Error).message ?? "")) throw notFound();
      return null; // Cal is down: the page renders and offers a retry.
    }
  },
  head: ({ loaderData: e, params }) => {
    if (!e) return { meta: [{ title: `Event — ${SITE}` }, { name: "robots", content: "noindex" }] };
    const title = `${e.title} — ${SITE}`;
    const when = formatRange(e.startTime, e.endTime, e.timeZone, "en-US");
    const description = `${when}${e.location ? ` · ${e.location}` : ""}${e.description ? `. ${e.description.slice(0, 140)}` : ""}`;
    const seo = e.unlisted ? { meta: [], links: [] } : canonicalTags(import.meta.env.VITE_SITE_URL as string | undefined, `/events/${params.slug}`);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "event" },
        ...(e.coverImageUrl?.startsWith("https://") ? [{ property: "og:image", content: e.coverImageUrl }] : []),
        { name: "twitter:card", content: "summary_large_image" },
        ...(e.unlisted ? [{ name: "robots", content: "noindex" }] : []),
        ...seo.meta,
      ],
      links: seo.links,
    };
  },
  component: GatheringPage,
});

function GatheringPage() {
  const { slug } = Route.useParams();
  const { business } = Route.useSearch();
  const loaded = Route.useLoaderData();
  const query = useQuery({ ...calEventQuery(slug, business), initialData: loaded ?? undefined });
  const event = query.data;
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        {!event ? (
          <div className="twc-wrap flex flex-col gap-6 py-20">
            <h1 className="twc-h2">Event</h1>
            {query.isError ? <ErrorBanner message="We couldn’t load this event right now." onRetry={() => void query.refetch()} /> : <EventsSkeleton />}
          </div>
        ) : (
          <>
            <EventHero event={event} />
            <div className="twc-wrap grid grid-cols-1 gap-10 pb-24 lg:grid-cols-[minmax(0,1fr)_400px]">
              <div className="flex min-w-0 flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <EventDateTime event={event} className="text-base" />
                  {event.location && <EventLocation location={event.location} />}
                </div>
                <EventDescription text={event.description} />
                <HostCard host={event.host} />
                <AttendanceSummary event={event} />
                <AttendeeList names={event.attendees} />
                <div><ShareButton title={event.title} path={`/events/${encodeURIComponent(event.slug)}`} /></div>
              </div>
              <RsvpPanel event={event} business={business} />
            </div>
          </>
        )}
      </main>
      <AppFooter />
    </AppPage>
  );
}
