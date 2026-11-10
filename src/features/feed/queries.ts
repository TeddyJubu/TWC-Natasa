import { infiniteQueryOptions } from "@tanstack/react-query";
import { feedFn } from "./fns";
import type { FeedFilter } from "./kinds";

export type { FeedAuthor, FeedPage, FeedPhoto, FeedPost, FeedReply, PostLoves } from "./feed.server";

/** The feed, newest first, 20 posts a page; each filter caches its own pages (members and admins; the server checks). */
export const feedQuery = (filter: FeedFilter) =>
  infiniteQueryOptions({
    queryKey: ["feed", filter],
    queryFn: ({ pageParam }) => feedFn({ data: { filter, cursor: pageParam } }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
  });
