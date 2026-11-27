import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { absoluteHttps, canonicalTags, jsonLdScript, parseSiteUrl } from "@/app/seo";
import {
  AttendanceSummary, AttendeeList, EventDateTime, EventDescription, EventHero, EventLocation, EventsSkeleton, HostCard, ShareButton,
} from "@/features/cal/events-ui";
import { isEnded, isFull, spotsLeft } from "@/features/cal/event-state";
import { calEventQuery } from "@/features/cal/queries";
import { RsvpPanel } from "@/features/cal/rsvp";
import { formatRange } from "@/features/cal/time";
import type { CalEventDetail } from "@/features/cal/types";
import { ErrorBanner } from "@/features/cal/ui";
import type { viewerFn } from "@/features/auth/fns";
import { gatheringsLd } from "@/features/events/structured-data";
import { viewerQuery } from "@/features/members/queries";

type Search = { business?: string };
const SITE = "The Women’s Collective";
type Viewer = Awaited<ReturnType<typeof viewerFn>>;
/** The event (null while Cal is down) and who is looking (null if that check failed: the guest form then). */
export type EventPageData = { event: CalEventDetail | null; viewer: Viewer | null };

export const Route = createFileRoute("/events_/$slug")({
  validateSearch: (raw: Record<string, unknown>): Search =>
    typeof raw.business === "string" && raw.business ? { business: raw.business.slice(0, 80) } : {},
  loaderDeps: ({ search }) => ({ business: search.business }),
  // Who is looking is asked here too, so the server's HTML already holds the right RSVP panel, not "Loading…".
  loader: async ({ context, params, deps }): Promise<EventPageData> => {
    const viewer = context.queryClient.ensureQueryData(viewerQuery).catch(() => null);
    try {
      return { event: await context.queryClient.ensureQueryData(calEventQuery(params.slug, deps.business)), viewer: await viewer };
    } catch (error) {
      if (/wasn.t found/i.test((error as Error).message ?? "")) throw notFound();
      return { event: null, viewer: await viewer }; // Cal is down: the page renders and offers a retry.
    }
  },
  head: ({ loaderData, params }) => {
    const e = loaderData?.event;
    if (!e) return { meta: [{ title: `Event — ${SITE}` }, { name: "robots", content: "noindex" }] };
    const title = `${e.title} — ${SITE}`;
    const when = formatRange(e.startTime, e.endTime, e.timeZone, "en-US");
    const description = `${when}${e.location ? ` · ${e.location}` : ""}${e.description ? `. ${e.description.slice(0, 140)}` : ""}`;
    const seo = e.unlisted ? { meta: [], links: [] } : canonicalTags(import.meta.env.VITE_SITE_URL as string | undefined, `/events/${params.slug}`);
    const site = parseSiteUrl(import.meta.env.VITE_SITE_URL as string | undefined);
    const image = absoluteHttps(site, e.coverSrc);
    // schema.org Event for a listed event only: an unlisted one stays out of search entirely.
    const ld = site && !e.unlisted ? gatheringsLd(site, [e]) : undefined;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "event" },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { name: "twitter:card", content: "summary_large_image" },
        ...(e.unlisted ? [{ name: "robots", content: "noindex" }] : []),
        ...seo.meta,
      ],
      links: seo.links,
      scripts: ld ? [jsonLdScript(ld)] : [],
    };
  },
  component: GatheringPage,
});

function GatheringPage() {
  const { slug } = Route.useParams();
  const { business } = Route.useSearch();
  const loaded = Route.useLoaderData();
  const query = useQuery({ ...calEventQuery(slug, business), initialData: loaded?.event ?? undefined });
  const event = query.data;
  // Approved members (and admins) answer as themselves; a failed check falls back to the guest form. The loader's
  // answer is the first one, so the server's HTML and the first browser render show the same panel.
  const viewer = useQuery({ ...viewerQuery, retry: false, initialData: loaded?.viewer ?? undefined });
  const member = !!(viewer.data?.member || viewer.data?.admin);
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        {!event ? (
          <div className="twc-phd flex flex-col items-stretch gap-6">
            <h1 className="twc-display">Event</h1>
            {query.isError ? <ErrorBanner message="We couldn’t load this event right now." onRetry={() => void query.refetch()} /> : <EventsSkeleton />}
          </div>
        ) : (
          <>
            <EventHero event={event} />
            <div className="twc-sec grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="flex min-w-0 flex-col gap-6">
                <div className="flex flex-col gap-2 text-[17px]">
                  <EventDateTime event={event} className="text-base" />
                  {event.location && <EventLocation location={event.location} map />}
                </div>
                <EarlyRsvp event={event} />
                <EventDescription text={event.description} />
                <HostCard host={event.host} />
                <AttendanceSummary event={event} />
                <AttendeeList names={event.attendees} />
                <div><ShareButton title={event.title} path={`/events/${encodeURIComponent(event.slug)}`} /></div>
              </div>
              <RsvpPanel event={event} business={business} member={member} checking={viewer.isPending} signedIn={viewer.data?.signedIn} />
            </div>
          </>
        )}
      </main>
      <AppFooter />
    </AppPage>
  );
}

/**
 * Below lg the RSVP panel comes after the description, host and guests, so the answer is one tap away up here: it
 * scrolls to the panel and moves focus into it (a button, not a #hash link, so the router's route focus stays out).
 */
function EarlyRsvp({ event }: { event: CalEventDetail }) {
  if (event.status === "CANCELLED" || isEnded(event)) return null;
  const left = spotsLeft(event);
  const go = () => {
    const panel = document.getElementById("rsvp");
    if (!panel) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    panel.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    panel.focus({ preventScroll: true });
  };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:hidden">
      <button type="button" className="twc-btn" onClick={go}>{isFull(event) ? "Join the waitlist" : "RSVP"}</button>
      {left !== null && <span className="text-sm">{left === 1 ? "1 spot left" : `${left} spots left`}</span>}
    </div>
  );
}
