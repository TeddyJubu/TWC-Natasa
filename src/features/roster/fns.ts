// The roster's server function: real members, only while the site is behind its PIN or for members and admins
// (roster.server.ts decides). Not in PUBLIC_FNS, so the PIN gate shuts it before it runs.
import { createServerFn } from "@tanstack/react-start";

export const rosterFn = createServerFn().handler(async () => {
  const [{ serve }, r] = await Promise.all([import("@/server/context.server"), import("./roster.server")]);
  return serve(r.roster);
});
