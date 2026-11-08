// Neighborhood server function (see src/features/members/fns.ts for the pattern).
import { createServerFn } from "@tanstack/react-start";

export const neighborhoodsFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./neighborhoods.server")]);
  return serve(m.listNeighborhoods);
});
