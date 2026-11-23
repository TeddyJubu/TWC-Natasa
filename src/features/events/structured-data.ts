// Event JSON-LD for /events. Pure: only the gathering's own stored facts, never a guessed one.
import { absoluteHttps, organizationLd } from "@/app/seo";
import type { CalEvent } from "@/features/cal/types";

const STATUS = { SCHEDULED: "https://schema.org/EventScheduled", CANCELLED: "https://schema.org/EventCancelled" } as const;

/** One Event per listed gathering, organised by the collective; undefined when there are none. */
export function gatheringsLd(site: string, events: readonly CalEvent[]) {
  if (events.length === 0) return undefined;
  const org = organizationLd(site);
  const imageOf = (e: CalEvent) => absoluteHttps(site, e.coverSrc);
  return {
    "@context": "https://schema.org",
    "@graph": [
      org,
      ...events.map((e) => ({
        "@type": "Event",
        name: e.title,
        ...(e.description ? { description: e.description } : {}),
        startDate: e.startTime,
        endDate: e.endTime,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: STATUS[e.status],
        url: `${site}/events/${encodeURIComponent(e.slug)}`,
        ...(imageOf(e) ? { image: imageOf(e) } : {}),
        ...(e.location ? { location: { "@type": "Place", name: e.location, address: e.location } } : {}),
        organizer: { "@id": org["@id"] },
      })),
    ],
  };
}
