import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MemberCard, MemberDialog, type MemberProfile, memberDialogActionClass } from "@/index";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Scallop } from "@/app/layout/twc";
import { useNeighborhoods } from "@/features/neighborhoods/queries";
import { pickerNames } from "@/features/neighborhoods/options";
import { toneFor } from "@/features/neighborhoods/tone";
import { directoryQuery, loadPublicProfiles, memberSlug, publicProfilesQuery, viewerQuery } from "@/features/members/queries";
import balconyFriends from "@/assets/photography/home/balcony-friends.webp";
import gathering from "@/assets/photography/event-800.webp";

export const Route = createFileRoute("/members")({
  // The public cards only, so the server renders them; members and admins switch to the directory on the client.
  loader: ({ context }) => loadPublicProfiles(context.queryClient),
  head: () => ({
    meta: [
      { title: "Member directory — The Women’s Collective" },
      { name: "description", content: "Meet a diverse community of women founders, creatives, professionals, and local leaders across Queens." },
      { property: "og:title", content: "Member directory — The Women’s Collective" },
      { property: "og:description", content: "Discover women doing remarkable work across Queens and the connections they hope to build." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const [activeNeighborhood, setActiveNeighborhood] = React.useState<string>("All");
  const [openMember, setOpenMember] = React.useState<MemberProfile | null>(null);
  const { data: hoodList = [] } = useNeighborhoods();
  const viewer = useQuery(viewerQuery);
  // Admins read the directory like approved members (public_directory() admits both).
  const member = viewer.data?.member === true || viewer.data?.admin === true;
  // Two audiences (§2.10): approved members get the full directory; everyone else, opted-in public cards.
  const directory = useQuery({ ...directoryQuery, enabled: member });
  // The loader's public cards show while the viewer is still unknown (and in the server's HTML).
  const publicCards = useQuery({ ...publicProfilesQuery, initialData: Route.useLoaderData(), enabled: viewer.isSuccess && !member });
  // A member keeps the server-rendered public cards on screen until her directory arrives (no loading flash).
  const list = member && (!directory.isPending || publicCards.data === undefined) ? directory : publicCards;
  const all = list.data ?? [];
  const audience = member ? "member" : viewer.data?.signedIn ? "pending" : "visitor";
  // A filter chosen in one audience can match nothing in the other.
  React.useEffect(() => setActiveNeighborhood("All"), [audience]);
  // Active neighborhoods in DB order, plus any a listed member still uses (e.g. one an admin deactivated).
  const neighborhoods = ["All", ...pickerNames(hoodList, all.map((m) => m.neighborhood))];
  const members = activeNeighborhood === "All"
    ? all
    : all.filter((m) => m.neighborhood === activeNeighborhood);
  const loading = !viewer.isError && list.isPending;
  const failed = viewer.isError || list.isError;
  const retry = () => void (viewer.isError ? viewer.refetch() : list.refetch());
  // Every listed card has a page its viewer may open: public cards for anyone, directory cards for members.
  const openSlug = openMember ? memberSlug(openMember) : undefined;

  return (
    <AppPage>
      <AppNav />

      <main id="main" tabIndex={-1} className="outline-none">
        <section className="twc-wrap flex flex-wrap items-center gap-12 pb-24 pt-18">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5">
            <p className="twc-eyebrow-script">member directory</p>
            <h1 className="twc-display">Meet the women in our constellation.</h1>
            <p className="twc-lede max-w-[560px]">Founders, makers, strategists, and neighbors sharing what they know and finding new ways to work together.</p>
            {viewer.isSuccess && audience !== "member" && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3 self-start rounded-[6px] bg-sb-cream px-5 py-3.5">
                <span className="text-sm">
                  {audience === "visitor"
                    ? "Showing members who share their profile publicly."
                    : "Showing members who share their profile publicly. Your directory unlocks once you’re welcomed in."}
                </span>
                {audience === "visitor" && (
                  <Link to="/auth" className="twc-link font-display text-[13px] uppercase leading-5 tracking-[1.6px] text-sb-blue-ink">
                    Sign in to see the full directory <span aria-hidden>→</span>
                  </Link>
                )}
              </div>
            )}
          </div>
          <div aria-hidden className="relative min-h-[400px] flex-[1_1_360px] max-sm:min-h-[340px]">
            <figure className="twc-polaroid twc-polaroid--left absolute left-[8%] top-2.5 w-[230px] max-sm:left-0 max-sm:w-[190px]">
              <img src={balconyFriends} alt="" width={800} height={1120} className="aspect-[4/5]" />
              <figcaption>neighbors → collaborators</figcaption>
            </figure>
            <figure className="twc-polaroid absolute right-[4%] top-[90px] w-[210px] max-sm:right-0 max-sm:w-[180px]">
              <img src={gathering} alt="" width={800} height={640} />
              <figcaption>the collective, in person</figcaption>
            </figure>
          </div>
        </section>

        <Scallop from="#fcfcfa" to="#f3f0e8" />
        <section className="twc-band twc-band--cream pb-26 pt-18">
          <div className="twc-wrap flex flex-col gap-9">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div className="flex flex-col gap-3">
                <span className="twc-eyebrow">The directory</span>
                <h2 className="twc-h2">A catalogue of women building nearby.</h2>
              </div>
              <p aria-live="polite" className="twc-index">{list.isSuccess && `${String(members.length).padStart(2, "0")} profiles`}</p>
            </div>

            <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
              <legend className="twc-eyebrow mb-3 text-sb-ink">Browse by neighborhood</legend>
              <div className="flex flex-wrap gap-2">
                {neighborhoods.map((neighborhood) => {
                  const color = toneFor(neighborhood, hoodList)?.color;
                  return (
                    <label key={neighborhood} className="twc-choice">
                      <input
                        type="radio"
                        name="neighborhood"
                        value={neighborhood}
                        checked={activeNeighborhood === neighborhood}
                        onChange={() => setActiveNeighborhood(neighborhood)}
                      />
                      {color && <span aria-hidden className="twc-dot bg-(--hood)" style={{ "--hood": color } as React.CSSProperties} />}
                      {neighborhood}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {failed && (
              <div role="alert" className="twc-notice twc-notice--danger flex-row flex-wrap items-center gap-4 self-start">
                <p>We couldn’t load the member directory right now.</p>
                <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" onClick={retry}>Retry</button>
              </div>
            )}

            {loading ? (
              <p role="status" className="text-sm text-sb-muted">Loading members…</p>
            ) : list.isSuccess && all.length === 0 ? (
              <div className="flex max-w-xl flex-col gap-3">
                <p className="font-display text-2xl">{audience === "member" ? "No members are listed yet." : "No one has shared a public profile yet."}</p>
                <p className="text-sm text-sb-muted">
                  {audience === "member"
                    ? "Switch on “Show me in the member directory” on your profile and you’ll be the first neighbor here."
                    : "Members choose whether their card appears on the public website. Check back soon."}
                </p>
              </div>
            ) : members.length === 0 ? (
              list.isSuccess && <p className="text-sm text-sb-muted">No one from {activeNeighborhood} here yet.</p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-6">
                {members.map((m) => (
                  <MemberCard key={m.id} member={m} variant="polaroid" tone={toneFor(m.neighborhood, hoodList)} onOpen={() => setOpenMember(m)} />
                ))}
              </div>
            )}
          </div>
        </section>
        <Scallop from="#f3f0e8" to="#edd22e" />

        <section className="twc-band twc-band--sun pb-26 pt-18">
          <div className="twc-wrap flex max-w-[760px] flex-col items-center gap-4.5 text-center">
            <p className="twc-eyebrow-script text-sb-ink">add your light</p>
            <h2 className="twc-h3">Your work belongs in the conversation.</h2>
            <p className="max-w-[520px] text-[17px]">Tell us about your work, the people you hope to meet, and how you want to contribute.</p>
            <Link to="/join" className="twc-btn mt-2">Start your application <span className="twc-arrow" aria-hidden>→</span></Link>
          </div>
        </section>
        <Scallop from="#edd22e" to="#fcfcfa" />
        <div className="h-12" />

        {/* Public cards carry only the fields a member chose to publish, so either audience may open one. */}
        <MemberDialog
          member={openMember}
          onClose={() => setOpenMember(null)}
          variant="polaroid"
          tone={openMember ? toneFor(openMember.neighborhood, hoodList) : undefined}
        >
          {openSlug && (
            <Link to="/members/$slug" params={{ slug: openSlug }} className={memberDialogActionClass}>
              Open full page <span aria-hidden>→</span>
            </Link>
          )}
        </MemberDialog>
      </main>

      <AppFooter />
    </AppPage>
  );
}
