import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { MemberProfile } from "@/index";
import { viewerFn } from "@/features/auth/fns";
import { directoryFn, introsFn, ownProfileFn, publicProfilesFn } from "./fns";

export type { Audience, MemberPage, Profile, ProfileData } from "./members.server";
export { memberSlug } from "./map";
export type { Viewer } from "@/features/auth/viewer.server";

/** Approved, listed members with portrait and logo URLs (members and admins; the server checks). */
export const directoryQuery = queryOptions({
  queryKey: ["directory"],
  queryFn: (): Promise<MemberProfile[]> => directoryFn(),
});

/**
 * Who is looking: signed out, signed in but not approved, an approved member, and/or an admin. The server answers
 * for this session only; `admin` only shapes the UI, every admin server function checks again.
 */
export const viewerQuery = queryOptions({
  queryKey: ["viewer"],
  queryFn: () => viewerFn(),
});

/** Opted-in public cards (§2.10), keyed by catalogue number: the server sends no ids. */
export const publicProfilesQuery = queryOptions({
  queryKey: ["public-profiles"],
  queryFn: (): Promise<MemberProfile[]> => publicProfilesFn(),
  // Fresh for a minute, so a page's useQuery does not fetch again what its loader just loaded.
  staleTime: 60_000,
});

/**
 * For route loaders, so the server renders the public cards: from the cache or the server, or undefined when that
 * fails (the page's query then loads them on the client). Public data only; members still read directoryQuery.
 */
export const loadPublicProfiles = (queryClient: QueryClient): Promise<MemberProfile[] | undefined> =>
  queryClient.ensureQueryData(publicProfilesQuery).catch(() => undefined);

/** Her own profile with image URLs (keyed by her id; the server reads the session, never a passed id). */
export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: () => ownProfileFn(),
  });

/**
 * Up to four approved, listed members, same neighborhood first (T15). Without a neighborhood there is no "same"
 * to ask for, so the first four from anywhere.
 */
export const introsQuery = (userId: string, neighborhood: string | null) =>
  queryOptions({
    queryKey: ["intros", userId, neighborhood],
    queryFn: (): Promise<MemberProfile[]> => introsFn({ data: { neighborhood } }),
  });
