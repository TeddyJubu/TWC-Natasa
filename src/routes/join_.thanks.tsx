import { createFileRoute } from "@tanstack/react-router";
import { StatusPage } from "@/app/layout/StatusPages";

/** /join/thanks: where a sent application lands. `join_` keeps it off /join's page; the PIN leaves it open (pin-open.ts). */
export const Route = createFileRoute("/join_/thanks")({
  head: () => ({ meta: [{ title: "Thank you — The Women’s Collective" }, { name: "robots", content: "noindex" }] }),
  component: JoinThanks,
});

function JoinThanks() {
  return (
    <StatusPage bare script="signed & sealed" tilt="-rotate-2" title="Thank you for applying." intro="We’ve received your application and we’ll be in touch." />
  );
}
