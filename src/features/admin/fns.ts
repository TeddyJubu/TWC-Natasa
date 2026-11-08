// Admin server functions (see src/features/members/fns.ts for the pattern); each one's domain code starts with requireAdmin.
import { createServerFn } from "@tanstack/react-start";

const pass = <T,>(input: unknown) => input as T;
type Status = "pending" | "approved" | "declined";

export const adminApplicationsFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
  return serve(m.adminApplications);
});

export const adminMembersFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
  return serve(m.adminMembers);
});

export const adminNeighborhoodsFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
  return serve(m.adminNeighborhoods);
});

export const adminBookingsFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
  return serve(m.adminBookings);
});

export const reviewApplicationFn = createServerFn({ method: "POST" })
  .validator(pass<{ id: string; status: Status }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
    return serve((c) => m.reviewApplication(c, data));
  });

export const setMemberStatusFn = createServerFn({ method: "POST" })
  .validator(pass<{ id: string; status: Status }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
    return serve((c) => m.setMemberStatus(c, data));
  });

export const setBookingStatusFn = createServerFn({ method: "POST" })
  .validator(pass<{ id: string; status: "confirmed" | "declined" }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
    return serve((c) => m.setBookingStatus(c, data));
  });

export const createNeighborhoodFn = createServerFn({ method: "POST" })
  .validator(pass<{ slug: string; name: string; color: string; sort_order: number }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
    return serve((c) => m.createNeighborhood(c, data));
  });

export const updateNeighborhoodFn = createServerFn({ method: "POST" })
  .validator(pass<{ slug: string; name: string; color: string; sort_order: number; active: boolean }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
    return serve((c) => m.updateNeighborhood(c, data));
  });

/** FormData: `slug` and `file`. Returns the stored `<slug>.<ext>`. */
export const saveNeighborhoodLogoFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error("Invalid upload");
    const slug = input.get("slug");
    const file = input.get("file");
    if (typeof slug !== "string" || !(file instanceof Blob)) throw new Error("Invalid upload");
    return { slug, file };
  })
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
    const bytes = new Uint8Array(await data.file.arrayBuffer());
    return serve((c) => m.saveNeighborhoodLogo(c, data.slug, bytes));
  });
