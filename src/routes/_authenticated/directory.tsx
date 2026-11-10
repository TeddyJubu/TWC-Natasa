// The signed-in member directory (DESIGN.md "Member directory"): a sheet of stamps on the airmail desk. Tapping a stamp
// tears it out onto the pass beside the sheet; tapping it again, or its empty spot, puts it back.
import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { cn, initials, type MemberProfile } from "@/index";
import { AppPage } from "@/app/layout/AppLayout";
import { EmptySlot, InlineError } from "@/app/layout/app-ui";
import { fieldClass, redButton, ring, secondaryButton } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";
import { AirShell } from "@/features/account/AirShell";
import { matchesSearch } from "@/features/admin/format";
import { useNeighborhoods } from "@/features/neighborhoods/queries";
import { pickerNames } from "@/features/neighborhoods/options";
import { directoryQuery, memberSlug, profileQuery, publicProfilesQuery, viewerQuery } from "@/features/members/queries";

export const Route = createFileRoute("/_authenticated/directory")({
  head: () => ({
    meta: [
      { title: "Members — The Women’s Collective" },
      { name: "description", content: "The member directory: a sheet of stamps, one for every member across Queens." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DirectoryPage,
});

/** Stamps on one sheet: four across, three down. */
const SHEET_SIZE = 12;
const no4 = (n?: number) => (n === undefined ? "" : String(n).padStart(4, "0"));
const printed = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "America/New_York" });

/** The small line under a stamp's name ("Café owner · Woodside"). */
function stampCaption(m: MemberProfile): string {
  // TODO(human)
  return m.neighborhood;
}

function DirectoryPage() {
  const { user } = Route.useRouteContext();
  const own = useQuery(profileQuery(user.id)).data;
  const viewer = useQuery(viewerQuery);
  // Admins read the directory like approved members; everyone else signed in sees the opted-in public cards.
  const member = viewer.data?.member === true || viewer.data?.admin === true;
  const directory = useQuery({ ...directoryQuery, enabled: member });
  const publicCards = useQuery({ ...publicProfilesQuery, enabled: viewer.isSuccess && !member });
  const list = member ? directory : publicCards;
  const all = list.data ?? [];
  const { data: hoodList = [] } = useNeighborhoods();

  const [hood, setHood] = React.useState("All");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [outId, setOutId] = React.useState<string | null>(null);
  const passRef = React.useRef<HTMLElement>(null);

  const count = (name: string) => all.filter((m) => m.neighborhood === name).length;
  const hoods = pickerNames(hoodList, all.map((m) => m.neighborhood)).filter((n) => count(n) > 0);
  const shown = all.filter((m) => (hood === "All" || m.neighborhood === hood)
    && matchesSearch(query, [m.name, m.role, m.business, m.specialty, m.neighborhood]));
  const pages = Math.max(1, Math.ceil(shown.length / SHEET_SIZE));
  const sheet = shown.slice(page * SHEET_SIZE, page * SHEET_SIZE + SHEET_SIZE);
  const out = all.find((m) => m.id === outId) ?? null;
  const filter = (next: () => void) => { next(); setPage(0); };

  function tear(m: MemberProfile) {
    const next = m.id === outId ? null : m.id;
    setOutId(next);
    // Below lg the pass sits above the sheet, out of view: bring it in.
    if (next && window.matchMedia("(max-width: 1023px)").matches) passRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  const loading = viewer.isPending || (!viewer.isError && list.isPending);
  const failed = viewer.isError || list.isError;

  return (
    <AppPage trail={false}>
      <AirShell
        page="/directory" admin={viewer.data?.admin === true} name={own?.profile.full_name || user.name || user.email}
        avatar={own?.avatarUrl} catalogueNumber={own?.profile.status === "approved" ? own.profile.catalogue_number : null}
      >
        <main id="main" tabIndex={-1} className="outline-none">
          <section className="air-dir-intro">
            <div>
              <p className="air-lbl">Member directory · Sheet Nº {page + 1} of {pages}</p>
              <h1>Members</h1>
            </div>
            <div>
              <p className="air-dir-lede">
                <b>{all.length || "No"} {all.length === 1 ? "member" : "members"} across Queens</b>, printed one stamp at a time. Tear one out to meet her.
              </p>
              <dl className="air-dir-stats">
                <div><dt>Members</dt><dd>{all.length}</dd></div>
                <div><dt>Neighborhoods</dt><dd>{hoods.length}</dd></div>
                <div><dt>Printed</dt><dd>{printed}</dd></div>
              </dl>
            </div>
          </section>

          {viewer.isSuccess && !member && (
            <p className="twc-notice mt-8 text-sm">Showing members who share their profile publicly. Your directory unlocks once you’re welcomed in.</p>
          )}

          <div className="air-dir-bar">
            <div role="group" aria-label="Filter by neighborhood" className="flex flex-wrap gap-2">
              {["All", ...hoods].map((name) => (
                <button key={name} type="button" aria-pressed={hood === name} onClick={() => filter(() => setHood(name))} className={cn("air-filter", ring)}>
                  {name}<span>{name === "All" ? all.length : count(name)}</span>
                </button>
              ))}
            </div>
            <label className="air-dir-search">
              <span className="sr-only">Search members</span>
              <input type="search" value={query} onChange={(e) => filter(() => setQuery(e.target.value))} placeholder="Search members" className={fieldClass} />
            </label>
          </div>

          {failed ? (
            <InlineError message="We couldn’t load the member directory right now." onRetry={() => void (viewer.isError ? viewer.refetch() : list.refetch())} />
          ) : loading ? (
            <p role="status" className="mt-16 text-sm text-app-muted">Loading members…</p>
          ) : (
            <div className="air-dir-split">
              <div>
                <Pass ref={passRef} member={out} />
                <p className="air-dir-hint"><Icon name="arrow-up" className="mt-0.5 size-4 rotate-[-45deg]" />Tap a stamp to tear it out. Tap it again, or its empty spot, to put it back.</p>
              </div>
              <div className="min-w-0">
                {sheet.length === 0 ? (
                  <EmptySlot>
                    <p className="air-empty-title">{all.length === 0 ? "No one is listed yet." : "No stamps match."}</p>
                    <p>{all.length === 0 ? "Members choose whether they appear here. Check back soon." : "Try another neighborhood or search."}</p>
                  </EmptySlot>
                ) : (
                  <div role="group" aria-label={`Member stamps, sheet ${page + 1}`} className="air-sheet">
                    {sheet.map((m) => <Stamp key={m.id} member={m} out={m.id === outId} onTear={() => tear(m)} />)}
                  </div>
                )}
                <div className="air-dir-foot">
                  <p>Showing {sheet.length} of {shown.length} · Sheet printed {printed}</p>
                  <div className="flex items-center gap-3.5 font-semibold text-ink">
                    <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous sheet" className={cn("air-icon-btn", ring)}><Icon name="arrow-left" className="size-4" /></button>
                    <span aria-live="polite">Sheet {page + 1} of {pages}</span>
                    <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next sheet" className={cn("air-icon-btn", ring)}><Icon name="arrow-right" className="size-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </AirShell>
    </AppPage>
  );
}

/** One stamp on the sheet: a real toggle button. Torn out, it lifts off and leaves a dashed spot to tap. */
function Stamp({ member: m, out, onTear }: { member: MemberProfile; out: boolean; onTear: () => void }) {
  const n = m.catalogueNumber;
  return (
    <button
      type="button" aria-pressed={out} onClick={onTear}
      aria-label={[m.name, m.role, m.neighborhood && `in ${m.neighborhood}`].filter(Boolean).join(", ")}
      className={cn("air-slot", ring, out && "is-out")}
    >
      <span aria-hidden className="air-slot-ghost">Torn out · tap to return</span>
      <span aria-hidden className="air-slot-stamp">
        <span className="air-slot-top">{n !== undefined && <><b>nº {String(n).padStart(2, "0")}</b><i>{n}¢</i></>}</span>
        <span className="air-slot-ph">{m.image ? <img src={m.image} alt="" loading="lazy" /> : <span>{initials(m.name)}</span>}</span>
        <span className="air-slot-foot">
          <span className="min-w-0"><strong>{m.name}</strong><small>{stampCaption(m)}</small></span>
          <em>twc.</em>
        </span>
      </span>
    </button>
  );
}

/** The torn-out member's pass: only the facts she published, never a placeholder. */
function Pass({ member: m, ref }: { member: MemberProfile | null; ref: React.Ref<HTMLElement> }) {
  const slug = m ? memberSlug(m) : undefined;
  return (
    <aside ref={ref} aria-live="polite" aria-label="Torn-out member" className={cn("air-dir-pass", !m && "is-empty")}>
      {!m ? (
        <div className="px-6 py-9 text-center">
          <div aria-hidden className="air-empty-stamp mx-auto mb-5"><span><Icon name="users" /></span></div>
          <h2>Nothing torn out</h2>
          <p className="mt-2.5 text-sm text-app-muted">Tap any stamp on the sheet to tear it out and meet her.</p>
        </div>
      ) : (
        <>
          <div className="air-dir-pass-head">
            <p className="flex items-center justify-between air-lbl mb-0"><b className="text-air-red">Torn out</b>{m.catalogueNumber !== undefined && <span>Nº {no4(m.catalogueNumber)}</span>}</p>
            <h2>{m.name}</h2>
            {(m.role || m.business) && <p className="mt-2 text-[13px] font-medium text-app-muted">{[m.role, m.business].filter(Boolean).join(", ")}</p>}
          </div>
          <div aria-hidden className="air-dir-perf" />
          <div className="px-6 pt-5 pb-6">
            {(m.neighborhood || m.specialty) && (
              <dl className="grid grid-cols-2 gap-4">
                {m.neighborhood && <div><dt className="air-lbl">Neighborhood</dt><dd className="text-[13px] font-bold">{m.neighborhood}</dd></div>}
                {m.specialty && <div><dt className="air-lbl">Craft</dt><dd className="text-[13px] font-bold">{m.specialty}</dd></div>}
              </dl>
            )}
            {m.bio && <div className="mt-5"><span className="air-lbl">In her words</span><p className="text-sm/[1.5]">{m.bio}</p></div>}
            {m.lookingFor && <div className="mt-4"><span className="air-lbl">Looking to meet</span><p className="border-b-[1.5px] border-air-rule pb-2 text-[13px]/[1.45] font-semibold">{m.lookingFor}</p></div>}
            <div className="mt-5 flex flex-col gap-2">
              {slug && <Link to="/members/$slug" params={{ slug }} className={cn(redButton, "w-full")}>Open her page<Icon name="arrow-right" /></Link>}
              {m.website && <a href={m.website} target="_blank" rel="noopener noreferrer" className={cn(secondaryButton, "w-full")}>Visit her website<Icon name="external-link" /><span className="sr-only"> (opens in a new tab)</span></a>}
            </div>
            {m.catalogueNumber !== undefined && (
              <div aria-hidden className="mt-5 flex items-end gap-3"><div className="air-dir-bars" /><span className="font-plex text-[11px] tracking-[0.1em]">WC-{no4(m.catalogueNumber)}</span></div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
