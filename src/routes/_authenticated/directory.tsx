// The signed-in directory (DESIGN.md "Member directory"): the canvas's `directory()` — its page head, the search,
// constellation and neighborhood filters, the people grid of directory cards beside the constellation map; a card or
// a star opens her profile. Members and admins read the real directory (`directoryQuery`); anyone else signed in
// reads the club's roster (`rosterQuery`), which is empty unless the site is behind its PIN — then only a notice.
import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/index";
import { AppPage } from "@/app/layout/AppLayout";
import { EmptySlot, InlineError } from "@/app/layout/app-ui";
import { fieldClass, ring, secondaryButton } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";
import { AirShell } from "@/features/account/AirShell";
import { matchesSearch } from "@/features/admin/format";
import { CONSTELLATIONS, DirectoryMap, type ConId } from "@/features/directory/DirectoryMap";
import { PersonCard, PersonDialog, fromMember, fromRoster, whereOf, type Person } from "@/features/directory/directory-people";
import { directoryQuery, profileQuery, viewerQuery } from "@/features/members/queries";
import { rosterQuery } from "@/features/roster/queries";

export const Route = createFileRoute("/_authenticated/directory")({
  head: () => ({
    meta: [
      { title: "Members — The Women’s Collective" },
      { name: "description", content: "The member directory: one card for every member across North Brooklyn and Queens." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DirectoryPage,
});

/** Cards on one page. */
const SHEET_SIZE = 12;

function DirectoryPage() {
  const { user } = Route.useRouteContext();
  const own = useQuery(profileQuery(user.id)).data;
  const viewer = useQuery(viewerQuery);
  // Admins read the directory like approved members. It is members-only (owner decision, 2026-11-24): anyone else
  // signed in (pending, declined) gets the roster at most — empty once the PIN is lifted — and never a database card.
  const member = viewer.data?.member === true || viewer.data?.admin === true;
  const outsider = viewer.isSuccess && !member;
  const list = useQuery({ ...directoryQuery, enabled: member });
  const roster = useQuery({ ...rosterQuery, enabled: outsider });
  const all: Person[] = React.useMemo(
    () => (member ? (list.data ?? []).map(fromMember) : (roster.data?.members ?? []).map(fromRoster)),
    [member, list.data, roster.data],
  );

  const [con, setCon] = React.useState<ConId | "all">("all");
  const [hood, setHood] = React.useState("All");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  const inCon = all.filter((p) => con === "all" || p.con === con);
  const count = (name: string) => inCon.filter((p) => p.hood === name).length;
  const hoods = [...new Set(inCon.map((p) => p.hood).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const shown = inCon.filter((p) => (hood === "All" || p.hood === hood)
    && matchesSearch(query, [p.name, p.role, p.business, p.member?.specialty, p.hood, whereOf(p), p.line]));
  const pages = Math.max(1, Math.ceil(shown.length / SHEET_SIZE));
  const sheet = shown.slice(page * SHEET_SIZE, page * SHEET_SIZE + SHEET_SIZE);
  const open = all.find((p) => p.key === openKey) ?? null;
  const filter = (next: () => void) => { next(); setPage(0); };
  const chooseCon = (next: ConId | "all") => filter(() => { setCon(next); setHood("All"); });

  const loading = viewer.isPending || (member ? list.isPending : outsider && roster.isPending);
  const failed = viewer.isError || list.isError || roster.isError;
  const empty = outsider && !loading && !failed && all.length === 0;
  const lead = member
    ? `Search ${all.length || "no"} ${all.length === 1 ? "member" : "members"} across North Brooklyn and Queens: a designer in Greenpoint, a bookkeeper in Astoria.`
    : "The women of the Collective, across North Brooklyn and Queens.";

  return (
    <AppPage trail={false}>
      <AirShell
        page="/directory" admin={viewer.data?.admin === true} name={own?.profile.full_name || user.name || user.email}
        avatar={own?.avatarUrl} catalogueNumber={own?.profile.status === "approved" ? own.profile.catalogue_number : null}
      >
        <main id="main" tabIndex={-1} className="outline-none">
          <section className="twc-phd">
            <div>
              <span className="twc-eyebrow">Directory &amp; map</span>
              <h1>Women-owned, <i>nearby</i></h1>
              <p className="twc-lede">{lead}</p>
            </div>
            {outsider && !empty && <span className="twc-flag">Full cards are for members</span>}
          </section>

          <section className="air-sec">
            {outsider && (
              viewer.data.declined ? (
                <div className="twc-notice mb-8 text-sm">
                  <p>The directory is for members, and your application wasn’t approved.</p>
                  <Link to="/contact" className={cn("air-link self-start", ring)}>Have a question? Contact us</Link>
                </div>
              ) : (
                <p className="twc-notice mb-8 text-sm">The directory is for members. It unlocks once you’re welcomed in.</p>
              )
            )}
            {failed ? (
              <InlineError message="We couldn’t load the member directory right now." onRetry={() => void (viewer.isError ? viewer.refetch() : member ? list.refetch() : roster.refetch())} />
            ) : loading ? (
              <p role="status" className="text-sm text-app-muted">Loading members…</p>
            ) : empty ? null : (
              <div className="dir-cols">
                <div className="min-w-0">
                  <div className="dir-bar">
                    <label className="dir-search">
                      <span className="sr-only">Search members</span>
                      <input type="search" value={query} onChange={(e) => filter(() => setQuery(e.target.value))} placeholder="Search by name, business, or specialty" className={fieldClass} autoComplete="off" spellCheck={false} />
                    </label>
                    <label className="dir-hood">
                      <span className="dir-hood-l">Neighborhood</span>
                      <select value={con} onChange={(e) => chooseCon(e.target.value as ConId | "all")} className={cn("dir-select", ring)} aria-label="Constellation">
                        <option value="all">All five constellations</option>
                        {CONSTELLATIONS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <div role="group" aria-label="Filter by neighborhood" className="dir-filters">
                      {["All", ...hoods].map((name) => (
                        <button key={name} type="button" aria-pressed={hood === name} onClick={() => filter(() => setHood(name))} className={cn("air-filter", ring)}>
                          {name}<span>{name === "All" ? inCon.length : count(name)}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Announced, so a search or filter says what it found (the grid itself changes silently). */}
                  <p aria-live="polite" className="dir-count">{shown.length < all.length ? `${shown.length} of ${all.length} match` : `${all.length} ${all.length === 1 ? "member" : "members"}`}</p>
                  {sheet.length === 0 ? (
                    <EmptySlot>
                      <p className="air-empty-title">{all.length === 0 ? "No one is listed yet." : "No members match yet."}</p>
                      <p>{all.length === 0 ? "Members choose whether they appear here. Check back soon." : "Try another name, specialty or neighborhood."}</p>
                      {all.length > 0 && (
                        <button type="button" onClick={() => filter(() => { setCon("all"); setHood("All"); setQuery(""); })} className={cn(secondaryButton, "mt-3")}>Show everyone</button>
                      )}
                    </EmptySlot>
                  ) : (
                    <div role="group" aria-label={`Members, page ${page + 1}`} className="people">
                      {sheet.map((p) => <PersonCard key={p.key} person={p} onOpen={() => setOpenKey(p.key)} />)}
                    </div>
                  )}
                  {pages > 1 && (
                    <div className="dir-pager">
                      <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page" className={cn("air-icon-btn", ring)}><Icon name="arrow-left" className="size-4" /></button>
                      <span aria-live="polite">Page {page + 1} of {pages}</span>
                      <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next page" className={cn("air-icon-btn", ring)}><Icon name="arrow-right" className="size-4" /></button>
                    </div>
                  )}
                </div>
                <DirectoryMap
                  con={con} onCon={chooseCon} onPin={setOpenKey}
                  pins={all.filter((p) => p.con).map((p) => ({ key: p.key, name: p.name, hood: p.hood, con: p.con!, caption: [p.role, p.business].filter(Boolean).join(", ") }))}
                />
              </div>
            )}
          </section>
          <PersonDialog person={open} onClose={() => setOpenKey(null)} />
        </main>
      </AirShell>
    </AppPage>
  );
}
