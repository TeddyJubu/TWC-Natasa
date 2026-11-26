// The design canvas's membership arches (docs/design-canvas/, arches()): four tiers as arched colour fields on the stone
// shelf, with the Monthly / Yearly switch. Prices and words as the canvas shows them (owner decision, 2026-11-26).
// Every button is JoinButton: the tiers are chosen on the application, so each goes to plain /join. Styles: .twc-arches
// in twc-sections.css. Shared by /membership and the home page.
import * as React from "react";
import { cn } from "@/index";
import { JoinButton } from "@/app/layout/twc";

type Tier = { n: string; field: string; k: string; p: [string, string]; s: [string, string]; f: string[]; cta: string; feat?: boolean };

const TIERS: Tier[] = [
  { n: "Guest", field: "twc-arch--white", k: "Try it", p: ["$0", "$0"], s: ["always free", "always free"], cta: "Get the newsletter",
    f: ["Weekly newsletter", "Public event calendar", "One free coffee or happy hour, by member invitation", "Tickets to panels and open workshops"] },
  { n: "Member", field: "twc-arch--blush", k: "Belong", p: ["$20", "$200"], s: ["per month", "per year"], cta: "Become a member",
    f: ["Your profile, findable on Google", "Pin on the Collective map", "Your constellation feed and rooms", "Monthly Constellation Zoom", "Coffees, happy hours and meetups included", "Member pricing on panels and workshops", "Invite a guest to her first social"] },
  { n: "Business", field: "twc-arch--cobalt", k: "Be seen", p: ["$40", "$435"], s: ["per month", "per year"], cta: "Promote my business", feat: true,
    f: ["Everything in Member", "Featured listing and Business badge", "All constellations, citywide", "Quarterly All-Constellation Zoom", "A yearly spotlight: video, newsletter, Instagram", "15% off Collective Services"] },
  { n: "Nonprofit", field: "twc-arch--butter", k: "Give back", p: ["$220", "$220"], s: ["per year", "per year"], cta: "Apply",
    f: ["Business benefits", "One free event listing a month", "Proof of nonprofit status required"] },
];

/** The arches section. `heading` is "h2" on a page that has its own h1 (home), "h1" where it opens the page (/membership). */
export function Arches({ heading: H = "h2" }: { heading?: "h1" | "h2" } = {}) {
  const [yearly, setYearly] = React.useState(true); // the canvas opens on Yearly
  const i = yearly ? 1 : 0;
  const T = H === "h1" ? "h2" : "h3"; // the tiers sit one level under the headline
  return (
    <section className="twc-arches" aria-labelledby="arches-title">
      <div className="twc-shead twc-arches__head">
        <div>
          <span className="twc-eyebrow">Membership 2027</span>
          <H id="arches-title" className="twc-h2 mt-3">Community is free to try. <i>Belonging</i> is a commitment.</H>
        </div>
        <div className="twc-bill" role="group" aria-label="Billing">
          <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
          <span aria-hidden>·</span>
          <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly, two months free</button>
        </div>
      </div>
      <div className="twc-arch-row">
        {TIERS.map((t) => (
          <div key={t.n} className={cn("twc-arch", t.field)}>
            {t.feat && <span className="twc-arch__badge">Most promotion</span>}
            <T className="twc-arch__title">{t.n}</T>
            <span className="twc-arch__k">{t.k}</span>
            <p className="twc-arch__amt">{t.p[i]}</p>
            <p className="twc-arch__per">{t.s[i]}</p>
            <ul>{t.f.map((x) => <li key={x}>{x}</li>)}</ul>
            <JoinButton className={t.feat ? "twc-btn--on-cobalt" : "twc-btn--outline"}>{t.cta}</JoinButton>
          </div>
        ))}
      </div>
    </section>
  );
}
