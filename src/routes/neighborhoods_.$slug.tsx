import * as React from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MemberDialog, cn, initials, memberDialogActionClass, type MemberProfile } from "@/index";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Icon } from "@/app/layout/twc";
import { memberSlug, publicProfilesQuery, viewerQuery } from "@/features/members/queries";
import { eventsQuery } from "@/features/events/queries";
import { eventWhen } from "@/features/events/format";
import { fetchNeighborhoods, type Neighborhood } from "@/features/neighborhoods/queries";
import { hasColor, textOn, toneFor } from "@/features/neighborhoods/tone";
import { neighborhoodPhoto } from "@/features/neighborhoods/photos";
import { HoodLogo } from "@/features/neighborhoods/HoodLogo";

export const Route = createFileRoute("/neighborhoods_/$slug")({
  // Unknown or inactive slugs are a real 404.
  loader: async ({ context, params }) => {
    const hood = (await fetchNeighborhoods(context.queryClient)).find((n) => n.slug === params.slug && n.active);
    if (!hood) throw notFound();
    return hood;
  },
  head: ({ loaderData }) => {
    const title = `${loaderData?.name ?? "Neighborhood"} — The Women’s Collective`;
    const description = `Meet the women of The Women’s Collective in ${loaderData?.name ?? "Queens"}, and find gatherings close to home.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: NeighborhoodPage,
});

const MAX_EVENTS = 3;

function NeighborhoodPage() {
  const hood = Route.useLoaderData();
  const [open, setOpen] = React.useState<MemberProfile | null>(null);
  const openSlug = open ? memberSlug(open) : undefined;
  const colored = hasColor(hood.color);
  const style = colored ? ({ "--hood": hood.color } as React.CSSProperties) : undefined;
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none" style={style}>
        <div className="twc-wrap flex flex-col gap-14 pb-[104px] pt-10">
          <Link to="/neighborhoods" className="twc-link inline-flex items-center gap-2 self-start font-display text-[13px] uppercase tracking-[1.6px]">
            <Icon name="arrowLeft" />All neighborhoods
          </Link>
          <Hero hood={hood} />
          <Members hood={hood} onOpen={setOpen} />
          <Gatherings hood={hood} />
          <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-6 rounded-[6px] bg-sb-cream p-6 sm:p-10">
            <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2.5">
              <h2 className="font-display text-[clamp(1.75rem,4vw,2.25rem)] leading-[1.15]">Live or work in {hood.name}?</h2>
              <p className="text-[17px] text-sb-muted">There is room in this constellation. Introduce yourself and meet the neighbors already here.</p>
            </div>
            <Link to="/join" className="twc-btn">Start your application <span className="twc-arrow" aria-hidden>→</span></Link>
          </div>
        </div>
        {/* Public cards carry only what the member chose to publish. */}
        <MemberDialog member={open} onClose={() => setOpen(null)} variant="polaroid" tone={open ? toneFor(open.neighborhood, [hood]) : undefined}>
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

/** Photo with the name card over it; without a photo, a color + logo tile (never a stand-in photo). */
function Hero({ hood }: { hood: Neighborhood }) {
  const photo = neighborhoodPhoto(hood.slug);
  const colored = hasColor(hood.color);
  const tone = colored ? textOn(hood.color) : undefined;
  // The card's body copy is small text: it stays on the color only where that reaches 4.5:1, else on paper.
  const cardOnColor = tone !== undefined && tone.ratio >= 4.5;
  return (
    <section
      aria-labelledby="hood-title"
      className={cn(
        "relative flex min-h-[360px] flex-col justify-end gap-6 overflow-hidden rounded-[22px] p-4 sm:flex-row sm:items-end sm:justify-start sm:p-8",
        !photo && (colored ? "bg-(--hood)" : "border-[1.5px] border-dashed border-sb-ink/35 bg-sb-cream"),
      )}
    >
      {photo ? (
        <img
          src={photo.src}
          srcSet={photo.srcSet}
          sizes="(min-width: 72rem) 64rem, 100vw"
          alt={`${hood.name}, Queens`}
          width={816}
          height={816}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <HoodLogo hood={hood} className="size-28 self-end p-5 sm:absolute sm:right-10 sm:top-1/2 sm:size-48 sm:-translate-y-1/2 sm:p-8" />
      )}
      <div
        className={cn(
          "relative flex max-w-[560px] flex-col gap-3 rounded-[6px] p-6 sm:p-7",
          cardOnColor ? "bg-(--hood)" : "bg-sb-paper",
          cardOnColor && tone.text === "paper" ? "text-sb-paper" : "text-sb-ink",
          colored && !cardOnColor && "border-l-8 border-(--hood)",
        )}
      >
        <span className="twc-chip self-start">Neighborhood</span>
        <h1 id="hood-title" className="twc-h3">{hood.name}</h1>
        <p>One corner of our constellation across Western Queens, with its own color and its own people.</p>
      </div>
    </section>
  );
}

function Members({ hood, onOpen }: { hood: Neighborhood; onOpen: (m: MemberProfile) => void }) {
  // Only members who opted into a public profile (§2.10) — never the members-only directory.
  const profiles = useQuery(publicProfilesQuery);
  const members = (profiles.data ?? []).filter((m) => m.neighborhood === hood.name);
  return (
    <section aria-labelledby="hood-members" className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="hood-members" className="twc-h3 min-w-0 text-[clamp(2rem,5vw,2.5rem)]">Women building in {hood.name}</h2>
        <Link to="/members" className="twc-link font-display text-[13px] uppercase leading-5 tracking-[1.6px] text-sb-blue-ink">See them in the directory →</Link>
      </div>
      {profiles.isPending ? (
        <p role="status" className="text-sm text-sb-muted">Loading members…</p>
      ) : profiles.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-4 text-sm text-sb-muted">
          <p>We couldn’t load members right now.</p>
          <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" onClick={() => void profiles.refetch()}>Retry</button>
        </div>
      ) : members.length === 0 ? (
        <p className="text-[15px] text-sb-muted">No one from {hood.name} has shared a public profile yet. Members choose whether their card appears on the website.</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-6">
          {members.map((m) => <li key={m.id}><MemberTile member={m} hood={hood} onOpen={() => onOpen(m)} /></li>)}
        </ul>
      )}
    </section>
  );
}

function MemberTile({ member, hood, onOpen }: { member: MemberProfile; hood: Neighborhood; onOpen: () => void }) {
  const colored = hasColor(hood.color);
  const role = [member.role, member.business].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={(e) => {
        // Safari and Firefox don't focus a clicked button; MemberDialog returns focus to it on close.
        e.currentTarget.focus();
        onOpen();
      }}
      aria-label={`View ${member.name}’s profile`}
      className="flex w-full cursor-pointer flex-col gap-3 bg-sb-paper px-3 pb-[18px] pt-3 text-left shadow-[0_10px_28px_rgb(31_31_28/0.12)] transition-[translate,box-shadow] duration-300 ease-[var(--ease-snap)] hover:-translate-y-1 hover:shadow-[0_10px_28px_rgb(31_31_28/0.2)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-sb-blue-ink motion-reduce:transform-none"
    >
      {member.image ? (
        <img src={member.image} alt="" loading="lazy" width={768} height={960} className="aspect-[4/5] w-full object-cover" />
      ) : (
        // Initials mat, never a stand-in photo. 64px initials are large text: the pick reaches 3:1 on any color.
        <span
          aria-hidden
          className={cn(
            "grid aspect-[4/5] w-full place-items-center font-display text-[64px] leading-none",
            colored ? "bg-(--hood)" : "bg-sb-cream",
            colored && textOn(hood.color).text === "paper" ? "text-sb-paper" : "text-sb-ink",
          )}
        >
          {initials(member.name)}
        </span>
      )}
      <span className="flex items-center gap-2 font-fragment text-xs uppercase leading-4 tracking-[1px] text-sb-muted">
        <span aria-hidden className={cn("twc-dot", colored ? "bg-(--hood)" : "border border-dashed border-sb-ink/35")} />{hood.name}
      </span>
      <span className="font-display text-[26px] leading-[1.2]">{member.name}</span>
      {role && <span className="text-sm text-sb-muted">{role}</span>}
    </button>
  );
}

function Gatherings({ hood }: { hood: Neighborhood }) {
  // Gatherings are members-only (the server checks); visitors get the way to the public gatherings page.
  const viewer = useQuery(viewerQuery);
  const member = viewer.data?.member === true || viewer.data?.admin === true;
  const events = useQuery({ ...eventsQuery, enabled: member });
  const here = (events.data ?? []).filter((e) => e.neighborhood === hood.name).slice(0, MAX_EVENTS);
  const across = <Link to="/gatherings" className="twc-inlink">See what’s happening across Queens →</Link>;
  return (
    <section aria-labelledby="hood-gatherings" className="flex flex-col gap-5">
      <h2 id="hood-gatherings" className="twc-h3 text-[clamp(2rem,5vw,2.5rem)]">Coming up in {hood.name}</h2>
      {member && events.isSuccess && here.length > 0 ? (
        <ul className="flex flex-col">
          {here.map((e) => {
            const when = eventWhen(e.starts_at);
            return (
              <li key={e.id}>
                <Link to="/gatherings" className="flex flex-wrap items-center gap-x-7 gap-y-5 border-y border-sb-ink/15 py-6 text-sb-ink hover:text-sb-ink focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-sb-blue-ink">
                  <span className="flex h-[104px] w-24 shrink-0 flex-col items-center justify-center gap-1.5 rounded-[6px] bg-sb-sun">
                    <span className="font-fragment text-xs uppercase leading-4 tracking-[2px]">{when.month}</span>
                    <span className="font-display text-[40px] leading-none">{when.day}</span>
                  </span>
                  <span className="flex min-w-0 flex-[1_1_300px] flex-col gap-2">
                    <span className="font-display text-[26px] leading-[1.25]">{e.title}</span>
                    <span className="inline-flex items-center gap-1.5 text-sm"><Icon name="clock" className="size-3.5" />{when.time}</span>
                    {e.location && <span className="inline-flex items-center gap-1.5 text-sm"><Icon name="pin" className="size-3.5" />{e.location}</span>}
                  </span>
                  <span className="twc-btn twc-btn--outline">Details <span className="twc-arrow" aria-hidden>→</span></span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-sb-muted">
          {member && events.isSuccess
            ? <>Nothing on the {hood.name} calendar yet. {across}</>
            : member && events.isError
              ? <>We couldn’t load gatherings right now. {across}</>
              : member && events.isPending
                ? <span role="status">Loading gatherings…</span>
                : <>Members see what’s coming up in {hood.name} here. {across}</>}
        </p>
      )}
    </section>
  );
}
