// The feed's fixed vocabulary and limits, shared by the server (feed.server.ts, which checks them) and the page.
import type { IconName } from "@/app/layout/icons";

export const FEED_KINDS = ["update", "ask", "offer", "gathering"] as const;
export type FeedKind = (typeof FEED_KINDS)[number];
/** How each kind reads on a post's chip and in the composer. */
export const KINDS: Record<FeedKind, { label: string; icon: IconName }> = {
  update: { label: "Update", icon: "megaphone" },
  ask: { label: "Ask", icon: "circle-help" },
  offer: { label: "Offer", icon: "tag" },
  gathering: { label: "Gathering", icon: "calendar" },
};
/** "hood" is her own neighborhood, which the server reads from her profile (never passed in). */
export const FEED_FILTERS = ["all", "hood", "asks", "gatherings"] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];
export const MAX_PHOTOS = 4;
export const MAX_POST = 5000;
export const MAX_REPLY = 2000;
export const MAX_ALT = 300;
