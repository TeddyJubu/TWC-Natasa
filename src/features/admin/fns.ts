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

type EventInput = { title: string; description: string; location: string; neighborhood: string; starts_at: string; kind: string };

export const adminEventsFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
  return serve(m.adminEvents);
});

export const createEventFn = createServerFn({ method: "POST" })
  .validator(pass<EventInput>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
    return serve((c) => m.createEvent(c, data));
  });

export const updateEventFn = createServerFn({ method: "POST" })
  .validator(pass<EventInput & { id: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
    return serve((c) => m.updateEvent(c, data));
  });

export const deleteEventFn = createServerFn({ method: "POST" })
  .validator(pass<{ id: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
    return serve((c) => m.deleteEvent(c, data));
  });

export const adminInboxFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
  return serve(m.adminInbox);
});

export const archiveMessageFn = createServerFn({ method: "POST" })
  .validator(pass<{ id: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
    return serve((c) => m.archiveMessage(c, data));
  });

export const adminNotesFn = createServerFn().handler(async () => {
  const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
  return serve(m.adminNotes);
});

export const addNoteFn = createServerFn({ method: "POST" })
  .validator(pass<{ applicationId: string; body: string } | { memberId: string; body: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
    return serve((c) => m.addNote(c, data));
  });

export const deleteNoteFn = createServerFn({ method: "POST" })
  .validator(pass<{ id: string }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
    return serve((c) => m.deleteNote(c, data));
  });

/** A POST so the export never sits in a GET cache or history; the browser saves the returned text as a file. */
export const adminCsvFn = createServerFn({ method: "POST" })
  .validator(pass<{ kind: "applications" | "members" }>)
  .handler(async ({ data }) => {
    const [{ serve }, m] = await Promise.all([import("@/server/context.server"), import("./admin.server")]);
    return serve((c) => m.adminCsv(c, data));
  });
