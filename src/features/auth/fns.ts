// Session server functions. Handlers lazy-import server code, so it never reaches the client bundle.
import { createServerFn } from "@tanstack/react-start";

/** The signed-in account ({ id, email, name }) or null. */
export const sessionFn = createServerFn().handler(async () => {
  const [{ ctx }, { sessionUser }] = await Promise.all([import("@/server/context.server"), import("./viewer.server")]);
  return sessionUser(await ctx());
});

/** Signed in / approved member / admin, for the current request only. */
export const viewerFn = createServerFn().handler(async () => {
  const [{ ctx }, { viewer }] = await Promise.all([import("@/server/context.server"), import("./viewer.server")]);
  return viewer(await ctx());
});
