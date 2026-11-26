import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/index";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { rosterQuery, type Roster } from "@/features/roster/queries";
import { CONSTELLATIONS } from "@/app/canvas/constellations";

const TITLE = "Leadership — The Women’s Collective";
const DESCRIPTION = "Every constellation is led by two or three women from the neighborhood. A citywide Advisory Council helps shape where we go next.";

export const Route = createFileRoute("/leadership")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeadershipPage,
});

type Seat = { name?: string; role: string; note?: string };
type Group = { title: string; note?: string; people: Seat[] };
const OPEN = (role: string): Seat => ({ role });

/** The canvas's teams. Every name comes from the roster (its leads and its founder), never from this public repo; a
 *  seat without one is the canvas's open seat. */
function groups(roster: Roster | undefined): Record<string, Group> {
  const founders = roster?.members.filter((m) => m.founder) ?? [];
  const isFounder = (n: string) => founders.some((f) => f.name === n);
  const lead = (key: keyof Roster["leads"], role: string, fallback?: string): Seat => {
    const name = roster?.leads[key];
    return name ? { name, role, note: isFounder(name) ? "Founder" : "Ambassador" } : fallback ? { name: fallback, role } : OPEN(role);
  };
  return {
    founder: { title: "Founder", people: founders.map((f) => ({ name: f.name, role: "Founder & CEO", note: CONSTELLATIONS.find((c) => c.short === f.constellation)?.name })) },
    council: { title: "Advisory Council", note: "Five to seven experienced women who advise the founder on programs, partners and growth. They give advice; the founder decides. One-year term.",
      people: [OPEN("Council Chair"), OPEN("Council member"), OPEN("Council member"), OPEN("Council member")] },
    nb: { title: "North Brooklyn", people: [lead("NB", "Constellation Lead"), OPEN("Programs Lead"), OPEN("Welcome Lead")] },
    wq: { title: "Western Queens", people: [lead("WQ", "Constellation Lead"), OPEN("Programs Lead"), OPEN("Welcome Lead")] },
    sb: { title: "Brownstone Brooklyn", people: [lead("SB", "Constellation Lead", "Ambassador onboarding"), OPEN("Programs Lead")] },
    manhattan: { title: "Manhattan", people: [lead("DT", "Downtown Lead"), lead("UP", "Uptown Lead")] },
    emeritus: { title: "Emeritus Council", note: "Past leaders who stay connected, mentor new leads and are honored at the Awards.", people: [OPEN("Emeritus")] },
    awards: { title: "Awards Committee", note: "Selects one woman per constellation for the Collective Awards each autumn.", people: [OPEN("Committee Chair"), OPEN("Committee member")] },
  };
}

// The canvas's portrait fields, chosen from the name so a person keeps her colour.
const FIELDS = ["twc-c-tomato", "twc-c-sky", "twc-c-blush", "twc-c-butter", "twc-c-lime", "twc-c-khaki", "twc-c-lilac", "twc-c-band-butter", "twc-c-band-lime"];
const fieldOf = (n: string) => FIELDS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % FIELDS.length];
const initials = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 2);

/** The design canvas's leadership page: the page head, then one team at a time, picked from "Meet the team". */
function LeadershipPage() {
  const roster = useQuery(rosterQuery).data;
  const all = groups(roster);
  const [key, setKey] = React.useState("founder");
  const g = all[key];
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <section className="twc-phd">
          <div className="min-w-0">
            <span className="twc-eyebrow">About us</span>
            <h1 className="twc-display">The women who <i>lead</i></h1>
            <p className="twc-lede">Every constellation is led by two or three women from the neighborhood. A citywide Advisory Council helps shape where we go next.</p>
          </div>
        </section>
        <section className="twc-sec pt-10">
          <div className="twc-lead">
            <div aria-live="polite">
              <h2 className="twc-h3">{g.title}</h2>
              {g.note && <p className="twc-lede mt-2">{g.note}</p>}
              <div className="twc-ports">
                {g.people.map((p, i) => {
                  const open = !p.name || p.name.startsWith("Ambassador ");
                  return (
                    <figure key={`${p.role}-${i}`} className="twc-port">
                      <div className={cn("twc-port__ph", open ? "twc-c-stone" : fieldOf(p.name!))} aria-hidden="true">{open ? "+" : initials(p.name!)}</div>
                      <figcaption className="twc-port__cap">{p.role}{p.note && ` · ${p.note}`}</figcaption>
                      <h3>{p.name ?? "Open seat"}</h3>
                      {open && <Link to="/contact" className="twc-btn twc-btn--outline twc-btn--sm mt-2.5 self-start">Apply for this seat</Link>}
                    </figure>
                  );
                })}
              </div>
            </div>
            <nav aria-label="Meet the team">
              <span className="twc-eyebrow">Meet the team</span>
              <div className="twc-leadnav">
                {Object.entries(all).map(([k, v]) => (
                  <button key={k} type="button" aria-pressed={k === key} onClick={() => setKey(k)}>{v.title}</button>
                ))}
              </div>
            </nav>
          </div>
        </section>
      </main>
      <AppFooter />
    </AppPage>
  );
}
