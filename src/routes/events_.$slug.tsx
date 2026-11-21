import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/events_/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/gatherings/$slug", params: { slug: params.slug }, statusCode: 301 });
  },
});
