import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/index";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Icon, Scallop } from "@/app/layout/twc";
import { sessionFn } from "@/features/auth/fns";
import { viewerQuery } from "@/features/members/queries";
import { useNeighborhoods } from "@/features/neighborhoods/queries";
import { toneFor } from "@/features/neighborhoods/tone";
import { loadPublicEvents, publicEventsQuery, rsvpsQuery, type PublicEvent } from "@/features/events/queries";
import { useToggleRsvp } from "@/features/events/mutations";
import { eventWhen, kindLabel } from "@/features/events/format";
import { gatheringsLd } from "@/features/events/structured-data";
import { jsonLdScript, parseSiteUrl } from "@/app/seo";

const TITLE = "Gatherings — The Women’s Collective";
const DESCRIPTION = "Coffee introductions, supper clubs and headshot days across Queens. See what’s coming up at The Women’s Collective.";

export const Route = createFileRoute("/gatherings")({
  // The calendar is public, so it is in the server's HTML; who is looking (the seat buttons) waits for the client.
  loader: ({ context }) => loadPublicEvents(context.queryClient),
  head: ({ loaderData }) => {
    const site = parseSiteUrl(import.meta.env.VITE_SITE_URL as string | undefined);
    const ld = site && loaderData ? gatheringsLd(site, loaderData) : undefined;
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      scripts: ld ? [jsonLdScript(ld)] : [],
    };
  },
  component: GatheringsPage,
});

/** Who is looking decides each gathering's button; the server functions check again on every RSVP. */
type Audience = "loading" | "visitor" | "pending" | "member";

function GatheringsPage() {
  const viewer = useQuery(viewerQuery);
  const events = useQuery({ ...publicEventsQuery, initialData: Route.useLoaderData() });
  const { data: hoodList = [] } = useNeighborhoods();
  // Admins pass requireMember, so they save seats like approved members.
  const member = viewer.data?.member === true || viewer.data?.admin === true;
  const audience: Audience = viewer.isPending ? "loading" : member ? "member" : viewer.data?.signedIn ? "pending" : "visitor";
  // The RSVP cache is keyed by account, like /account's.
  const session = useQuery({ queryKey: ["session"], queryFn: () => sessionFn(), enabled: member });
  const userId = session.data?.id ?? "";
  const rsvps = useQuery({ ...rsvpsQuery(userId), enabled: !!userId });
  const toggle = useToggleRsvp(userId);
  const going = new Set(rsvps.data ?? []);

  const [hood, setHood] = React.useState("All");
  const all = events.data ?? [];
  const present = new Set(all.map((e) => e.neighborhood));
  // Neighborhoods with something coming up, in the collective's order (any unknown one last).
  const hoods = [...new Set([...hoodList.map((h) => h.name).filter((n) => present.has(n)), ...present])];
  const shown = hood === "All" ? all : all.filter((e) => e.neighborhood === hood);

  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <section className="twc-wrap flex flex-col gap-5 pt-18 pb-14">
          <p className="twc-eyebrow-script">gatherings</p>
          <h1 className="twc-display">Show up locally.</h1>
          <p className="twc-lede max-w-160">
            Coffee introductions, supper clubs and headshot days across Queens. Members save a seat; everyone can see what’s coming up.
          </p>
        </section>

        <section aria-labelledby="coming-up" className="twc-wrap flex flex-col gap-9 pb-26">
          {hoods.length > 1 && (
            <div className="flex flex-col gap-3">
              <span id="hood-filter" className="twc-eyebrow text-sb-ink">Browse by neighborhood</span>
              <div role="group" aria-labelledby="hood-filter" className="flex flex-wrap gap-2">
                {["All", ...hoods].map((name) => {
                  const color = toneFor(name, hoodList)?.color;
                  return (
                    <button
                      key={name} type="button" aria-pressed={hood === name} onClick={() => setHood(name)}
                      className="twc-choice aria-pressed:bg-sb-ink aria-pressed:text-sb-paper aria-pressed:shadow-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-sb-blue-ink"
                    >
                      {color && <span aria-hidden className="twc-dot bg-(--hood)" style={hoodVar(color)} />}
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h2 id="coming-up" className="twc-h3 mb-4">Coming up</h2>
            {toggle.isError && <p role="alert" className="twc-error mb-4">{messageOf(toggle.error)}</p>}
            {rsvps.isError && (
              <Problem message="We couldn’t load your saved seats." onRetry={() => void rsvps.refetch()} />
            )}
            {events.isPending ? (
              <p role="status" className="text-sb-muted">Loading gatherings…</p>
            ) : events.isError ? (
              <Problem message="We couldn’t load the calendar right now." onRetry={() => void events.refetch()} />
            ) : all.length === 0 ? (
              <p className="twc-lede">No gatherings on the calendar yet. We’ll post the next one here.</p>
            ) : shown.length === 0 ? (
              <p className="text-sb-muted">Nothing coming up in {hood} yet.</p>
            ) : (
              <ol>
                {shown.map((ev, i) => (
                  <GatheringRow key={ev.id} ev={ev} tile={i % 2 === 0 ? "bg-sb-sun" : "bg-sb-cream"} color={toneFor(ev.neighborhood, hoodList)?.color}>
                    <SeatAction
                      title={ev.title} audience={audience} going={going.has(ev.id)}
                      disabled={toggle.isPending || !rsvps.isSuccess}
                      onToggle={() => toggle.mutate({ eventId: ev.id, going: !going.has(ev.id) })}
                    />
                  </GatheringRow>
                ))}
              </ol>
            )}
          </div>
        </section>

        {/* ponytail: the board's "Recently." photo band waits for real gathering photos (shown only with them). */}

        <Scallop from="#fcfcfa" to="#edd22e" />
        <section aria-labelledby="host" className="twc-band twc-band--sun pt-18 pb-26">
          <div className="twc-wrap flex max-w-190 flex-col items-center gap-4.5 text-center">
            <h2 id="host" className="twc-h3">Want to host one?</h2>
            <p className="max-w-135 text-[17px]">
              Members host, sponsor and collaborate on gatherings in their own neighborhoods. Tell us what you have in mind.
            </p>
            <Link to="/contact" className="twc-btn mt-2">Pitch a gathering <span className="twc-arrow" aria-hidden>→</span></Link>
          </div>
        </section>
        <Scallop from="#edd22e" to="#fcfcfa" />
        <div className="h-12" />
      </main>
      <AppFooter />
    </AppPage>
  );
}

const hoodVar = (color: string) => ({ "--hood": color }) as React.CSSProperties;
const messageOf = (error: unknown) => (error as { message?: string } | null)?.message || "Something went wrong. Please try again.";

function Problem({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="mb-4 flex flex-wrap items-center gap-4">
      <p className="text-sb-ink">{message}</p>
      <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" onClick={onRetry}>Retry</button>
    </div>
  );
}

function GatheringRow({ ev, tile, color, children }: { ev: PublicEvent; tile: string; color?: string; children: React.ReactNode }) {
  const when = eventWhen(ev.starts_at);
  const headingId = `gathering-${ev.id}`;
  return (
    <li className="flex flex-wrap items-center gap-x-8 gap-y-6 border-b border-sb-ink/15 py-8 first:border-t">
      <div className={cn("flex h-28 w-26 flex-none flex-col items-center justify-center gap-1.5 rounded-md text-center text-sb-ink", tile)}>
        <span className="font-fragment text-xs/4 tracking-[2px] uppercase">{when.month}</span>
        <span className="font-display text-[40px] leading-none">{when.day}</span>
      </div>
      <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-2.5">
        <span className="twc-eyebrow">{kindLabel(ev.kind)}</span>
        <h3 id={headingId} className="font-display text-[26px]/[1.25] break-words">{ev.title}</h3>
        {ev.description && <p className="text-sb-muted">{ev.description}</p>}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-4.5 gap-y-2 text-sm">
          <span className="twc-chip twc-chip--ring">
            <span aria-hidden className={cn("twc-dot", color ? "bg-(--hood)" : "bg-sb-ink/25")} style={color ? hoodVar(color) : undefined} />
            {ev.neighborhood}
          </span>
          <span className="inline-flex items-center gap-1.5"><Icon name="clock" className="size-3.5" />{when.weekday} · {when.time}</span>
          <span className="inline-flex items-center gap-1.5"><Icon name="pin" className="size-3.5" />{ev.location}</span>
        </div>
      </div>
      {children}
    </li>
  );
}

/** Signed out → sign in; signed in but not yet approved → locked; approved → save / un-save. */
function SeatAction({ title, audience, going, disabled, onToggle }: {
  title: string; audience: Audience; going: boolean; disabled: boolean; onToggle: () => void;
}) {
  const forTitle = <span className="sr-only"> for {title}</span>;
  if (audience === "loading") return null;
  if (audience === "visitor") {
    return (
      <Link to="/auth" className="twc-btn twc-btn--outline">
        Sign in to save a seat{forTitle} <span className="twc-arrow" aria-hidden>→</span>
      </Link>
    );
  }
  if (audience === "pending") {
    return <button type="button" disabled className="twc-btn twc-btn--outline">Unlocks once you’re welcomed in{forTitle}</button>;
  }
  return (
    <button type="button" disabled={disabled} onClick={onToggle} className={cn("twc-btn", going && "twc-btn--outline")}>
      {going ? <>Seat saved{forTitle} <span aria-hidden>✓</span></> : <>Save my seat{forTitle}</>}
    </button>
  );
}
