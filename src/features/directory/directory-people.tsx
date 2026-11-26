// The directory's people (the canvas's `.dcard` and its `.dprof` profile dialog) for both sources: members from the
// database (`directoryQuery`, members and admins) and the club's roster (`rosterQuery`, behind the PIN). Each shows
// only the facts its source has — a portrait or her initials, never a stand-in, and no invented badge.
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogClose, DialogContent } from "@ui-sdk/react/dialog";
import { cn, formatCatalogueNumber, initials, safeHref, type MemberProfile } from "@/index";
import { mainButton, ring, secondaryButton } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";
import { areaOfPlace } from "@/features/applications/schema";
import { memberSlug } from "@/features/members/queries";
import type { RosterMember } from "@/features/roster/queries";
import { conName, conOfHood, type ConId } from "./DirectoryMap";

/** One card in the grid, whichever list it came from. */
export type Person = {
  key: string; name: string; role: string; business: string; hood: string; con?: ConId; image?: string; founder?: boolean;
  /** Her own line (her bio, or the roster's line). */
  line?: string;
  /** The database record, when she is a member the viewer may read. */
  member?: MemberProfile;
};

const ROSTER_CON: Record<RosterMember["constellation"], ConId> = { NB: "nb", WQ: "wq", SB: "sb", UP: "uptown", DT: "downtown" };
/** A member's constellation: her neighborhood's on the map, else her area's (the club's Queens is Western Queens). */
const conOf = (hood: string): ConId | undefined => {
  const area = areaOfPlace(hood)?.id;
  return conOfHood(hood) ?? (area === "north-brooklyn" ? "nb" : area === "queens" ? "wq" : undefined);
};

export function fromMember(m: MemberProfile): Person {
  return { key: m.id, name: m.name, role: m.role, business: m.business, hood: m.neighborhood, con: m.neighborhood ? conOf(m.neighborhood) : undefined, image: m.image, line: m.bio.trim() || undefined, member: m };
}
export function fromRoster(r: RosterMember, i: number): Person {
  return { key: `r${i}`, name: r.name, role: r.role ?? "", business: r.business ?? "", hood: r.hood, con: ROSTER_CON[r.constellation], image: r.photo, founder: r.founder, line: r.line };
}

export const whereOf = (p: Person) => [p.hood, p.con && conName(p.con)].filter(Boolean).join(" · ");

function Portrait({ person: p }: { person: Person }) {
  return p.image ? <img src={p.image} alt="" loading="lazy" decoding="async" /> : <span className="dcard-mono">{initials(p.name)}</span>;
}

/** The canvas's directory card: portrait (opens her card), badges, name, work, where, her line and "View profile". */
export function PersonCard({ person: p, onOpen }: { person: Person; onOpen: () => void }) {
  return (
    <article className="dcard">
      <button type="button" className={cn("dcard-ph", ring)} onClick={onOpen} tabIndex={-1} aria-hidden>
        <Portrait person={p} />
      </button>
      {p.founder && <div className="dcard-badges"><span className="dbadge is-founder">Founder</span></div>}
      <h3>{p.name}</h3>
      {(p.role || p.business) && <p className="dcard-job">{p.role}{p.business && <span>{p.business}</span>}</p>}
      {p.hood && <p className="dcard-where">{whereOf(p)}</p>}
      {p.line && <p className="dcard-line">{p.line}</p>}
      <button type="button" className={cn("dcard-view", ring)} onClick={onOpen} aria-label={`View ${p.name}’s profile`}>
        View profile <span aria-hidden>→</span>
      </button>
    </article>
  );
}

/** Her card as the canvas's profile dialog (`.dprof`): only the facts her source has. */
export function PersonDialog({ person, onClose }: { person: Person | null; onClose: () => void }) {
  // Keep the last person while the dialog closes, so it never paints empty.
  const [p, setP] = React.useState(person);
  if (person && person !== p) setP(person);
  const nameId = React.useId();
  const m = p?.member;
  const slug = m ? memberSlug(m) : undefined;
  // Websites are free text: only an http(s) URL becomes a link (never javascript: and the like).
  const website = m?.website ? safeHref(m.website) : undefined;
  return (
    <Dialog open={person !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent aria-labelledby={nameId} className="dprof-dialog">
        <div className="dprof-center">
          {p && (
            <div className="dprof">
              <div className="dprof-in">
                <DialogClose className={cn("dprof-x", ring)} aria-label="Close">×</DialogClose>
                <div className="dprof-media">
                  <figure><Portrait person={p} /></figure>
                  {m?.logo && <figure className="dprof-logo"><img src={m.logo} alt={`${m.business || m.name} logo`} /></figure>}
                </div>
                <div className="dprof-txt">
                  {(p.founder || m?.catalogueNumber !== undefined) && (
                    <div className="dcard-badges">
                      {p.founder && <span className="dbadge is-founder">Founder</span>}
                      {m?.catalogueNumber !== undefined && <span className="dbadge">No. {formatCatalogueNumber(m.catalogueNumber)}</span>}
                    </div>
                  )}
                  <h2 id={nameId}>{p.name}</h2>
                  {(p.role || p.business) && <p className="dcard-job">{p.role}{p.business && <span>{p.business}</span>}</p>}
                  {p.hood && <p className="dcard-where">{whereOf(p)}</p>}
                  {p.line && <p className="dprof-line">{p.line}</p>}
                  {m?.specialty && <p className="dprof-ind"><span>Craft</span>{m.specialty}</p>}
                  {m?.lookingFor && <p className="dprof-ind"><span>Looking to meet</span>{m.lookingFor}</p>}
                  {(slug || website) && (
                    <div className="dprof-acts">
                      {slug && <Link to="/members/$slug" params={{ slug }} className={mainButton}>Open her page<Icon name="arrow-right" /></Link>}
                      {website && <a href={website} target="_blank" rel="noopener noreferrer" className={secondaryButton}>Visit her website<Icon name="external-link" /><span className="sr-only"> (opens in a new tab)</span></a>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
