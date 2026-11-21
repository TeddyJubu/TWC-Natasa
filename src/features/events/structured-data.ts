// Event JSON-LD for /gatherings. Pure: only the gathering's own stored facts, never a guessed one.
import { organizationLd } from "@/app/seo";
import type { CalEvent } from "@/features/cal/types";

const STATUS = { SCHEDULED: "https://schema.org/EventScheduled", CANCELLED: "https://schema.org/EventCancelled" } as const;

/** One Event per listed gathering, organised by the collective; undefined when there are none. */
export function gatheringsLd(site: string, events: readonly CalEvent[]) {
  if (events.length === 0) return undefined;
  const org = organizationLd(site);
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
        url: `${site}/gatherings/${encodeURIComponent(e.slug)}`,
        ...(e.coverImageUrl?.startsWith("https://") ? { image: e.coverImageUrl } : {}),
        ...(e.location ? { location: { "@type": "Place", name: e.location, address: e.location } } : {}),
        organizer: { "@id": org["@id"] },
      })),
    ],
  };
}
