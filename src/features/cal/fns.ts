// Cal server functions (see src/features/members/fns.ts for the pattern). Reads for visitors return only public fields;
// everything named admin* starts with requireAdmin in cal.server.ts. Writes with a body from visitors are server routes.
import { createServerFn } from "@tanstack/react-start";
import type { ListInput, SlotsInput } from "./cal.server";

const pass = <T,>(input: unknown) => input as T;
const load = () => Promise.all([import("@/server/context.server"), import("./cal.server")]);
type Business = { business?: string };

export const calEventsFn = createServerFn()
  .validator(pass<ListInput>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve(() => m.listPublicEvents(data));
  });

export const calEventFn = createServerFn()
  .validator(pass<{ slug: string } & Business>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve(() => m.getPublicEvent(String(data.slug).slice(0, 120), data.business));
  });

export const calEventTypesFn = createServerFn()
  .validator(pass<Business>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve(() => m.listEventTypes(data?.business));
  });

export const calEventTypeFn = createServerFn()
  .validator(pass<{ slug: string } & Business>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve(() => m.getEventType(String(data.slug).slice(0, 120), data.business));
  });

export const calSlotsFn = createServerFn()
  .validator(pass<SlotsInput>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve(() => m.getSlots(data));
  });

export const calBookingFn = createServerFn()
  .validator(pass<{ uid: string; seat?: string | null } & Business>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve(() => m.getPublicBooking(data.uid, data.seat, data.business));
  });

export const adminBusinessesFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await load();
  return serve(m.adminBusinesses);
});

export const adminCalEventsFn = createServerFn()
  .validator(pass<{ tab?: "upcoming" | "past"; skip?: number; take?: number } & Business>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve((c) => m.adminEvents(c, data));
  });

export const adminCalEventFn = createServerFn()
  .validator(pass<{ uid: string } & Business>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve((c) => m.adminEvent(c, data));
  });

export const saveCalEventFn = createServerFn({ method: "POST" })
  .validator(pass<{ uid?: string; event: unknown } & Business>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve((c) => m.saveAdminEvent(c, data));
  });

export const cancelCalEventFn = createServerFn({ method: "POST" })
  .validator(pass<{ uid: string } & Business>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve((c) => m.cancelAdminEvent(c, data));
  });

export const adminCalRsvpsFn = createServerFn()
  .validator(pass<{ uid: string } & Business>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve((c) => m.adminRsvps(c, data));
  });

export const addCalRsvpFn = createServerFn({ method: "POST" })
  .validator(pass<{ uid: string; rsvp: unknown } & Business>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve((c) => m.addAdminRsvp(c, data));
  });

export const adminCalBookingsFn = createServerFn()
  .validator(pass<{ status?: string; skip?: number } & Business>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve((c) => m.adminBookings(c, data));
  });

export const adminCalEventTypesFn = createServerFn()
  .validator(pass<Business>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve((c) => m.adminEventTypes(c, data));
  });

export const saveCalEventTypeFn = createServerFn({ method: "POST" })
  .validator(pass<{ eventType: unknown } & Business>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await load();
    return serve((c) => m.saveEventType(c, data));
  });
