// Gathering server functions (see src/features/members/fns.ts for the pattern).
import { createServerFn } from "@tanstack/react-start";

const pass = <T,>(input: unknown) => input as T;

export const eventsFn = createServerFn()
  .validator((input: unknown) => ({ from: typeof (input as { from?: unknown } | null)?.from === "string" ? (input as { from: string }).from : undefined }))
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./events.server")]);
    return serve((c) => m.listEvents(c, data.from));
  });

export const rsvpsFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./events.server")]);
  return serve(m.rsvps);
});

export const setRsvpFn = createServerFn({ method: "POST" })
  .validator(pass<{ eventId: string; going: boolean }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./events.server")]);
    return serve((c) => m.setRsvp(c, data));
  });

export const bookingFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./events.server")]);
  return serve(m.booking);
});

export const bookHeadshotFn = createServerFn({ method: "POST" })
  .validator(pass<{ preferred_date: string; preferred_time: string; notes: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./events.server")]);
    return serve((c) => m.bookHeadshot(c, data));
  });
