// The design canvas's five constellation bands (docs/design-canvas/, bands()), shared by `/` and `/constellations`: a
// native <details> folder whose white sheet holds the words, the star chart and the sliding profile cards. Members and
// the leads' names come only from the roster (rosterQuery: real data that never enters this public repository, empty
// for a visitor once the PIN is lifted). Only a constellation not yet live draws open seats; a live one with no members
// to show (the roster loading, hidden, or naming nobody there) has no card row at all.
import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { rosterQuery, type RosterMember } from "@/features/roster/queries";
import { JoinButton } from "@/app/layout/twc";
import { StarChart } from "@/app/StarChart";
import { CONSTELLATIONS } from "./constellations";

type Con = (typeof CONSTELLATIONS)[number];

/** `cardHeading`: the profile cards' name level, one below the section's own heading (h3 under an h2, h2 under the h1). */
export function Bands({ cardHeading = "h3" }: { cardHeading?: "h2" | "h3" }) {
  const roster = useQuery(rosterQuery).data;
  return (
    <div className="twc-cbands">
      {CONSTELLATIONS.map((c, i) => (
        <Band key={c.short} c={c} no={i + 1} H={cardHeading} lead={roster?.leads[c.short]}
          members={(roster?.members ?? []).filter((m) => m.constellation === c.short && !m.founder)} />
      ))}
    </div>
  );
}

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** One constellation (canvas bands()): a native <details> folder whose sheet holds the words, the star chart and the
 *  sliding profile cards; a member's spark and card light up together (data-m), and a spark shows her card. */
function Band({ c, no, lead, members, H }: { c: Con; no: number; H: "h2" | "h3"; lead?: string; members: RosterMember[] }) {
  const [hl, setHl] = useState<string | null>(null);
  const slider = useRef<HTMLDivElement>(null);
  const ids = members.map((_, i) => `${c.short.toLowerCase()}-${String(i + 1).padStart(2, "0")}`);
  const behavior = (): ScrollBehavior => (reduced() ? "auto" : "smooth");
  // A star shows her card: the slider turns to it and the page brings it into view (it sits below the chart).
  const show = (id: string) => {
    setHl(id);
    const el = slider.current, card = el?.querySelector<HTMLElement>(`[data-m="${id}"]`);
    if (el && card) {
      el.scrollTo?.({ left: card.offsetLeft - el.offsetLeft - 8, behavior: behavior() });
      el.scrollIntoView?.({ block: "nearest", behavior: behavior() });
    }
  };
  const by = lead ?? c.led;
  return (
    <details className={`twc-cband ${c.field}`}>
      <summary>
        <span className="twc-cband__no">Nº{no}<b>{c.short}</b></span>
        <span className="twc-cband__name">{c.name}</span>
        <span className="twc-cband__st">{c.status}<span className="twc-cband__cue" aria-hidden /></span>
      </summary>
      <div className="twc-cband__more" onMouseOver={(e) => setHl((e.target as Element).closest<HTMLElement>("[data-m]")?.dataset.m ?? null)} onMouseLeave={() => setHl(null)}>
        <div>
          <p className="body">{c.body}</p>
          {c.live
            ? <JoinButton className="[&_.twc-arrow]:hidden">Join {c.name}</JoinButton>
            : <span className="twc-cband__acts">
                {c.news && <Link to="/" hash="letter" className="twc-btn">Get launch news</Link>}
                <Link to="/contact" className={c.news ? "twc-btn twc-btn--outline" : "twc-btn"}>Apply to lead it</Link>
              </span>}
        </div>
        <div className="twc-cband__chart">
          <StarChart id={c.short} name={c.name} hoods={c.hoods} live={c.live} hl={hl} onPick={show}
            members={members.map((m, i) => ({ id: ids[i], name: m.name, hood: m.hood, job: [m.role, m.business].filter(Boolean).join(" · ") }))} />
        </div>
        {(members.length > 0 || !c.live) && <div className="twc-pf">
          <div className="twc-pf__head">
            <button type="button" className="twc-pf__btn" aria-label="Previous profiles" onClick={() => slider.current?.scrollBy({ left: -slider.current.clientWidth * 0.8, behavior: behavior() })}>←</button>
            <button type="button" className="twc-pf__btn" aria-label="Next profiles" onClick={() => slider.current?.scrollBy({ left: slider.current.clientWidth * 0.8, behavior: behavior() })}>→</button>
          </div>
          <div ref={slider} className="twc-pslide" tabIndex={0} role="region" aria-label={`${c.name} member profiles`} {...dragScroll}>
            {members.length ? members.map((m, i) => (
              <article key={ids[i]} data-m={ids[i]} className={`twc-pf-card${hl === ids[i] ? " is-hl" : ""}`}>
                <H className="twc-pf-card__name">{breakFirst(m.name)}<sup>{String(i + 1).padStart(2, "0")}</sup></H>
                <figure className="twc-pf-card__ph"><img src={m.photo} alt={m.name} loading="lazy" decoding="async" draggable={false} /></figure>
                {m.role && <p className="twc-pf-card__job">{m.role}{m.business && <span>{m.business}</span>}</p>}
                <span className="twc-pf-card__tag">{m.hood}</span>
              </article>
            )) : [1, 2].map((n) => (
              <article key={n} className="twc-pf-card is-open">
                <H className="twc-pf-card__name">Your<br />name here<sup>0{n}</sup></H>
                <figure className="twc-pf-card__ph" aria-hidden><span>☆</span></figure>
                <p className="twc-pf-card__line">Every constellation is led by two or three women who live there. This seat is open.</p>
                <span className="twc-pf-card__tag">Ambassador</span>
              </article>
            ))}
          </div>
        </div>}
        {by && <p className="twc-meta twc-cband__facts">Led by<br />{by}</p>}
      </div>
    </details>
  );
}

// The canvas sets a card's name on two lines: the first name, then the rest.
const breakFirst = (name: string) => { const i = name.indexOf(" "); return i < 0 ? name : <>{name.slice(0, i)}<br />{name.slice(i + 1)}</>; };

// Drag the profile slider with a mouse, as the canvas does (touch scrolls natively; the arrows and keys still work).
const drag = { el: null as HTMLElement | null, x0: 0, s0: 0, moved: false };
const dragScroll = {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    Object.assign(drag, { el: e.currentTarget, x0: e.clientX, s0: e.currentTarget.scrollLeft, moved: false });
  },
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
    const el = drag.el, dx = e.clientX - drag.x0;
    if (!el) return;
    if (!drag.moved && Math.abs(dx) > 4) { drag.moved = true; el.classList.add("is-drag"); }
    if (drag.moved) el.scrollLeft = drag.s0 - dx;
  },
  onPointerUp: () => { drag.el?.classList.remove("is-drag"); drag.el = null; },
  onPointerLeave: () => { drag.el?.classList.remove("is-drag"); drag.el = null; },
};
