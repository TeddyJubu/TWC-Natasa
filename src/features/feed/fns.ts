// Newsfeed server functions. Each handler lazy-imports feed.server.ts (kept out of the client bundle) and runs it
// through serve(); the domain code checks membership and validates the input. New posts go to POST /api/feed.
import { createServerFn } from "@tanstack/react-start";

const pass = <T,>(input: unknown) => input as T;

export const feedFn = createServerFn()
  .validator(pass<{ filter: string; cursor: string | null }>)
  .handler(async ({ data }) => {
    const [{ serve }, f] = await Promise.all([import("@/server/context.server"), import("./feed.server")]);
    return serve((c) => f.feed(c, data));
  });

export const loveFn = createServerFn({ method: "POST" })
  .validator(pass<{ postId: string; on: boolean }>)
  .handler(async ({ data }) => {
    const [{ serve }, f] = await Promise.all([import("@/server/context.server"), import("./feed.server")]);
    return serve((c) => f.love(c, data));
  });

export const replyFn = createServerFn({ method: "POST" })
  .validator(pass<{ postId: string; body: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, f] = await Promise.all([import("@/server/context.server"), import("./feed.server")]);
    return serve((c) => f.reply(c, data));
  });

export const deletePostFn = createServerFn({ method: "POST" })
  .validator(pass<{ id: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, f] = await Promise.all([import("@/server/context.server"), import("./feed.server")]);
    return serve((c) => f.deletePost(c, data));
  });

export const deleteReplyFn = createServerFn({ method: "POST" })
  .validator(pass<{ id: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, f] = await Promise.all([import("@/server/context.server"), import("./feed.server")]);
    return serve((c) => f.deleteReply(c, data));
  });
