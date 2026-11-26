// The design canvas's five constellation bands (docs/design-canvas/, bands()): a coloured tab (number, name, status) that
// opens onto a white sheet with its words, its lead, the star chart and its members' profile cards. Members and leads
// come only from the roster (rosterQuery: empty for a visitor once the PIN is lifted), never from this public repo; a
// band with no members draws the canvas's two open seats. Styles: .twc-cband in twc-sections.css.
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { rosterQuery, type RosterMember } from "@/features/roster/queries";
import { Icon, JoinButton } from "@/app/layout/twc";
import { StarChart } from "@/app/StarChart";
import { CONSTELLATIONS } from "./constellations";


export function Bands() {
  const roster = useQuery(rosterQuery).data;
  return (
    <div className="twc-cbands">
      {CONSTELLATIONS.map((c, i) => {
        // A lead's name only from the roster; a band without one keeps the canvas's words (never a person) or none.
        const led = roster?.leads[c.short] ?? c.led;
        return (
          <details key={c.short} className={`twc-cband ${c.field}`}>
            <summary>
              <span className="twc-cband__no">Nº{i + 1}<b>{c.short}</b></span>
              <span className="twc-cband__name">{c.name}</span>
              <span className="twc-cband__st">{c.status}</span>
            </summary>
            <div className="twc-cband__more">
              <div>
                {c.head && <p className="twc-cband__head">{c.head}</p>}
                <p className="body">{c.body}</p>
                {c.live ? <JoinButton>Join {c.name}</JoinButton> : (
                  <Link to="/partnerships" className="twc-btn">Apply to lead it <Icon name="arrow" className="twc-arrow" /></Link>
                )}
                {led && <p className="twc-meta mt-6">Led by<br />{led}</p>}
              </div>
              <div>
                <StarChart id={c.short} name={c.name} hoods={c.hoods} />
                <p className="twc-cband__outline" aria-hidden="true">{c.hoods}</p>
              </div>
              <Profiles name={c.name} members={(roster?.members ?? []).filter((m) => m.constellation === c.short)} />
            </div>
          </details>
        );
      })}
    </div>
  );
}

const first = (n: string) => n.split(" ")[0];
const rest = (n: string) => n.split(" ").slice(1).join(" ");

/** The canvas's sliding member cards: a real member's name, photo, work and neighborhood, or two open seats. */
function Profiles({ name, members }: { name: string; members: RosterMember[] }) {
  const slide = React.useRef<HTMLDivElement>(null);
  const step = (dir: number) => slide.current?.scrollBy({ left: dir * 250 });
  return (
    <div className="twc-pf">
      <div className="twc-pf__head">
        <button type="button" className="twc-pf__btn" aria-label="Previous profiles" onClick={() => step(-1)}>←</button>
        <button type="button" className="twc-pf__btn" aria-label="Next profiles" onClick={() => step(1)}>→</button>
      </div>
      <div ref={slide} className="twc-pf__slide" tabIndex={0} role="group" aria-label={`${name} member profiles`}>
        {members.length > 0 ? members.map((m, i) => (
          <article key={m.photo} className="twc-pf__card">
            <p className="twc-pf__name">{first(m.name)}<br />{rest(m.name)}<sup>{String(i + 1).padStart(2, "0")}</sup></p>
            <figure className="twc-pf__ph"><img src={m.photo} alt={m.name} loading="lazy" decoding="async" draggable={false} /></figure>
            {m.role && <p className="twc-pf__job">{m.role}{m.business && <span>{m.business}</span>}</p>}
            <span className="twc-pf__tag">{m.hood}</span>
          </article>
        )) : [0, 1].map((i) => (
          <article key={i} className="twc-pf__card twc-pf__card--open">
            <p className="twc-pf__name">Your<br />name here<sup>0{i + 1}</sup></p>
            <figure className="twc-pf__ph" aria-hidden="true">☆</figure>
            <p className="twc-pf__line">Every constellation is led by two or three women who live there. This seat is open.</p>
            <span className="twc-pf__tag">Ambassador</span>
          </article>
        ))}
      </div>
    </div>
  );
}
