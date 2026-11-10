// The members' newsfeed (DESIGN.md "Newsfeed"): a masthead, the composer, filters and the posts, newest first, with
// her pass on one side and neighbors to meet and what's coming up on the other. Approved members and admins only.
import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { MemberDialog, cn, type MemberProfile } from "@/index";
import { AppPage } from "@/app/layout/AppLayout";
import { Chip, EmptySlot, InlineError, Stamp } from "@/app/layout/app-ui";
import { ring, secondaryButton } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";
import { AirShell } from "@/features/account/AirShell";
import { eventsQuery, rsvpsQuery } from "@/features/events/queries";
import { eventWhen } from "@/features/events/format";
import { introsQuery, profileQuery, viewerQuery, type ProfileData } from "@/features/members/queries";
import { Composer } from "@/features/feed/Composer";
import { FeedPost, MiniStamp } from "@/features/feed/FeedPost";
import { feedQuery } from "@/features/feed/queries";
import type { FeedFilter } from "@/features/feed/kinds";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "The feed — The Women’s Collective" },
      { name: "description", content: "News, asks, offers and gatherings from members across Queens." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FeedPage,
});

const no4 = (n: number) => String(n).padStart(4, "0");
/** Gatherings in the side column. */
const COMING_UP = 4;

function FeedPage() {
  const { user } = Route.useRouteContext();
  const own = useQuery(profileQuery(user.id)).data;
  const viewer = useQuery(viewerQuery);
  const member = viewer.data?.member === true || viewer.data?.admin === true;
  const name = own?.profile.full_name || user.name || user.email;
  const hood = own?.profile.neighborhood ?? null;
  const [filter, setFilter] = React.useState<FeedFilter>("all");
  const [openMember, setOpenMember] = React.useState<MemberProfile | null>(null);
  const feed = useInfiniteQuery({ ...feedQuery(filter), enabled: member });
  const pages = feed.data?.pages ?? [];
  const posts = pages.flatMap((p) => p.posts);
  const head = pages[0];
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" });

  const filters: [FeedFilter, string][] = [["all", "All posts"], ...(hood ? [["hood", hood] as [FeedFilter, string]] : []), ["asks", "Asks & offers"], ["gatherings", "Gatherings"]];

  return (
    <AppPage trail={false}>
      <AirShell
        page="/feed" admin={viewer.data?.admin === true} name={name} avatar={own?.avatarUrl}
        catalogueNumber={own?.profile.status === "approved" ? own.profile.catalogue_number : null}
      >
        <main id="main" tabIndex={-1} className="air-feed outline-none">
          <div className="air-feed-main">
            <section className="air-feed-mast">
              <div>
                <p className="air-lbl">{today} · Queens edition</p>
                <h1>The feed</h1>
              </div>
              {head && <p className="air-feed-note"><span aria-hidden className="air-dot" />{head.week ? `${head.week} new this week` : "Quiet this week"}</p>}
            </section>

            {viewer.isError ? (
              <InlineError message="We couldn’t load the feed right now." onRetry={() => void viewer.refetch()} />
            ) : viewer.isPending ? (
              <p role="status" className="air-feed-status">Loading the feed…</p>
            ) : !member ? (
              <div className="mt-8">
                <EmptySlot icon="shield-check">
                  <p className="air-empty-title">Unlocks once you’re welcomed in</p>
                  <p>Members share news, asks, offers and gatherings here.</p>
                  {own && !own.hasApplication && <Link to="/join" className={cn("air-link", ring)}>Haven’t applied yet? Start your application</Link>}
                </EmptySlot>
              </div>
            ) : (
              <>
                <Composer name={name} image={own?.avatarUrl} />
                <div role="group" aria-label="Filter the feed" className="air-feed-filters">
                  {filters.map(([key, label]) => (
                    <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={cn("air-filter", ring)}>{label}</button>
                  ))}
                </div>
                {feed.isError && !feed.data ? (
                  <InlineError message="We couldn’t load the feed right now." onRetry={() => void feed.refetch()} />
                ) : feed.isPending ? (
                  <p role="status" className="air-feed-status">Loading posts…</p>
                ) : posts.length === 0 ? (
                  <EmptySlot icon="newspaper">
                    <p className="air-empty-title">{filter === "all" ? "Nothing posted yet" : "No posts here yet"}</p>
                    <p>{filter === "all" ? "Be the first: share a win, an ask or an offer." : "Try another filter, or post the first one."}</p>
                  </EmptySlot>
                ) : (
                  <div className="air-feed-list">{posts.map((p) => <FeedPost key={p.id} post={p} />)}</div>
                )}
                {feed.isFetchNextPageError && <p role="alert" className="air-post-err mt-4">We couldn’t load older posts. Please try again.</p>}
                {posts.length > 0 && (feed.hasNextPage ? (
                  <div className="air-feed-more">
                    <button type="button" onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage} className={secondaryButton}>
                      <Icon name="arrow-down" />{feed.isFetchingNextPage ? "Loading…" : "Older posts"}
                    </button>
                  </div>
                ) : <p className="air-feed-end">You’re all caught up</p>)}
              </>
            )}
          </div>

          {member && (
            <>
              <aside aria-label="Your pass" className="air-feed-rail">
                <FeedPass own={own} name={name} mine={head?.mine} />
                <p className="air-dir-hint"><Icon name="shield-check" className="mt-0.5 size-4" />Keep it neighborly: wins, asks, offers and gatherings. Cold sales pitches get returned to sender.</p>
              </aside>
              <aside aria-label="Neighbors and gatherings" className="air-feed-side">
                <Neighbors userId={user.id} hood={hood} onOpen={setOpenMember} />
                <ComingUp userId={user.id} />
              </aside>
            </>
          )}
          <MemberDialog member={openMember} onClose={() => setOpenMember(null)} />
        </main>
      </AirShell>
    </AppPage>
  );
}

/** Her pass in the colour she picked on /account, with her tally on the feed. Only facts that are set. */
function FeedPass({ own, name, mine }: { own: ProfileData | null | undefined; name: string; mine?: { posts: number; loves: number } }) {
  const p = own?.profile;
  const n = p?.status === "approved" ? p.catalogue_number : null;
  const caption = [p?.specialty || p?.role_title, p?.neighborhood].filter(Boolean).join(" · ");
  return (
    <section aria-label="Your member pass" className={cn("air-feed-pass", `pass--${p?.card_color ?? "mustard"}`)}>
      <p className="air-feed-pass-top"><b>Member pass</b>{n != null && <span>Nº {no4(n)}</span>}</p>
      <div className="air-feed-pass-who">
        <MiniStamp name={name} image={own?.avatarUrl} size="xl" />
        <div className="min-w-0"><p className="air-feed-pass-name">{name}</p>{caption && <p className="air-feed-pass-cap">{caption}</p>}</div>
      </div>
      <div aria-hidden className="air-feed-pass-perf" />
      {mine && (
        <dl className="air-feed-pass-tally">
          <div><dt>Posts</dt><dd>{mine.posts}</dd></div>
          <div><dt>Loves</dt><dd>{mine.loves}</dd></div>
        </dl>
      )}
      {n != null && <div aria-hidden className="air-feed-pass-code"><div className="air-dir-bars" /><span>WC-{no4(n)}</span></div>}
    </section>
  );
}

/** Up to four members to meet, her neighborhood first (the same introductions /account shows); each opens her card. */
function Neighbors({ userId, hood, onOpen }: { userId: string; hood: string | null; onOpen: (m: MemberProfile) => void }) {
  const intros = useQuery(introsQuery(userId, hood));
  const list = intros.data ?? [];
  if (list.length === 0) return null;
  return (
    <section aria-labelledby="neighbors-title">
      <div className="air-feed-h"><h2 id="neighbors-title">Neighbors to meet</h2><Link to="/directory" className={cn("air-link", ring)}>All members</Link></div>
      <div className="air-sheet air-sheet--pair">
        {list.map((m) => <Stamp key={m.id} member={m} label={`View ${m.name}’s profile`} onClick={() => onOpen(m)} />)}
      </div>
      <p className="air-feed-why">{hood ? `Neighbors from ${hood} first, then across Queens.` : "Neighbors from across Queens."}</p>
    </section>
  );
}

/** The next few gatherings, with the ones she's going to marked. */
function ComingUp({ userId }: { userId: string }) {
  const events = useQuery(eventsQuery);
  const rsvps = new Set(useQuery(rsvpsQuery(userId)).data ?? []);
  const next = (events.data ?? []).slice(0, COMING_UP);
  if (next.length === 0) return null;
  return (
    <section aria-labelledby="coming-up-title">
      <div className="air-feed-h"><h2 id="coming-up-title">Coming up</h2><Link to="/account" hash="gatherings" className={cn("air-link", ring)}>All gatherings</Link></div>
      <ul className="air-feed-events">
        {next.map((e) => {
          const when = eventWhen(e.starts_at);
          const going = rsvps.has(e.id);
          return (
            <li key={e.id}>
              <div aria-hidden className={cn("air-feed-date", going && "is-going")}><b>{when.day}</b><small>{when.weekday}</small></div>
              <div className="min-w-0">
                <p className="font-semibold">{e.title}</p>
                <p className="air-post-meta">{when.weekday}, {when.month} {when.day} · {when.time}{e.location && ` · ${e.location}`}</p>
                {going && <Chip tone="ok" className="mt-1.5">You’re going</Chip>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
