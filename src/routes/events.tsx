import { createFileRoute, redirect } from "@tanstack/react-router";

// The calendar's old address; search params (a filter in a shared link) carry over.
export const Route = createFileRoute("/events")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/gatherings", search: search as never, statusCode: 301 });
  },
});
