import { createFileRoute, redirect } from "@tanstack/react-router";

/** The neighborhoods list is the canvas's constellations page now (owner decision, 2026-11-26); each neighborhood keeps
 *  its own page at /neighborhoods/$slug. */
export const Route = createFileRoute("/neighborhoods")({
  beforeLoad: () => {
    throw redirect({ to: "/constellations", statusCode: 301 });
  },
});
