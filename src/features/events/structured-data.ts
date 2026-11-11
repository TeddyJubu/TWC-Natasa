// Event JSON-LD for /gatherings. Pure: only the gathering's own stored facts, never a guessed one.
import { organizationLd } from "@/app/seo";
import type { PublicEvent } from "./queries";

// The sample gatherings migration 0001 seeds (title + start); a fresh database still lists them as upcoming,
// so they are never marked up as real events. Anything an admin adds is real.
const DEMO_EVENTS = new Set([
  "Waterfront Coffee Introductions|2026-10-18T14:00:00.000Z",
  "Headshot Session Day|2026-10-25T15:00:00.000Z",
  "Founders Supper Club|2026-11-06T23:00:00.000Z",
  "Skill Swap Saturday|2026-11-14T15:00:00.000Z",
]);
export const isDemoEvent = (e: Pick<PublicEvent, "title" | "starts_at">) => DEMO_EVENTS.has(`${e.title}|${e.starts_at}`);

/** One Event per real gathering, organised by the collective; undefined when there are none. */
export function gatheringsLd(site: string, events: readonly PublicEvent[]) {
  const real = events.filter((e) => !isDemoEvent(e));
  if (real.length === 0) return undefined;
  const org = organizationLd(site);
  return {
    "@context": "https://schema.org",
    "@graph": [
      org,
      ...real.map((e) => ({
        "@type": "Event",
        name: e.title,
        ...(e.description ? { description: e.description } : {}),
        startDate: e.starts_at,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        url: `${site}/gatherings`,
        location: {
          "@type": "Place",
          name: e.location,
          address: { "@type": "PostalAddress", addressLocality: e.neighborhood, addressRegion: "NY", addressCountry: "US" },
        },
        organizer: { "@id": org["@id"] },
      })),
    ],
  };
}
