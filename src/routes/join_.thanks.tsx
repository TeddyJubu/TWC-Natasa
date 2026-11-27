import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { StatusPage } from "@/app/layout/StatusPages";
import { Icon } from "@/app/layout/twc";
import { readHandoffEmail } from "@/features/applications/handoff";

/** /join/thanks: where a sent application lands. `join_` keeps it off /join's page; the PIN leaves it open (pin-open.ts). */
export const Route = createFileRoute("/join_/thanks")({
  head: () => ({ meta: [{ title: "Thank you — The Women’s Collective" }, { name: "robots", content: "noindex" }] }),
  component: JoinThanks,
});

/**
 * What happens after she applies, true facts only: every application is read and answered by email; approval sends
 * the welcome email (admin approve → emailApproval) and opens her card, events and the directory; and the login can be
 * made now (verifying links her application by email). No review time, no price and no payment: none is decided.
 */
const NEXT = [
  "The collective reads every application and replies by email.",
  "Once you’re approved, we send a welcome email, and your member card, events and the members’ directory open to you.",
  "You can create your login now, with the email you applied with.",
];

function JoinThanks() {
  // Handed on from /join in the history state, never the URL; read after hydration, so the server's HTML matches.
  const [email, setEmail] = React.useState<string>();
  React.useEffect(() => setEmail(readHandoffEmail()), []);
  return (
    <StatusPage bare script="signed & sealed" tilt="-rotate-2" title="Thank you for applying." intro="We’ve received your application and we’ll be in touch.">
      <section aria-labelledby="next-title" className="flex w-full max-w-[62ch] flex-col gap-4">
        <h2 id="next-title" className="twc-label">What happens next</h2>
        <ol className="twc-next">
          {NEXT.map((step, i) => (
            <li key={step}><span className="twc-index" aria-hidden>{String(i + 1).padStart(2, "0")}</span><p>{step}</p></li>
          ))}
        </ol>
        <Link to="/auth" search={{ mode: "signup" }} state={email ? { applicantEmail: email } : undefined} className="twc-btn self-start">
          Create your login <Icon name="arrow" className="twc-arrow" />
        </Link>
      </section>
    </StatusPage>
  );
}
