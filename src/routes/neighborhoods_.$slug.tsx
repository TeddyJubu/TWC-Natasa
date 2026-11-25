import * as React from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MemberDialog, cn, initials, memberDialogActionClass, type MemberProfile } from "@/index";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Icon, JoinButton } from "@/app/layout/twc";
import { directoryQuery, memberSlug, viewerQuery } from "@/features/members/queries";
import { eventsQuery } from "@/features/events/queries";
import { eventWhen } from "@/features/events/format";
import { fetchNeighborhoods, type Neighborhood } from "@/features/neighborhoods/queries";
import { hasColor, textOn, toneFor } from "@/features/neighborhoods/tone";
import { neighborhoodPhoto } from "@/features/neighborhoods/photos";
import { HoodLogo } from "@/features/neighborhoods/HoodLogo";
import { areaOfPlace } from "@/features/applications/schema";
import { breadcrumbLd, canonicalTags, jsonLdScript, parseSiteUrl } from "@/app/seo";

export const Route = createFileRoute("/neighborhoods_/$slug")({
  // Unknown or inactive slugs are a real 404. No member data: her neighbors are members-only, loaded in the browser.
  loader: async ({ context, params }) => {
    const hood = (await fetchNeighborhoods(context.queryClient)).find((n) => n.slug === params.slug && n.active);
    if (!hood) throw notFound();
    return { hood };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.hood.name;
    const title = `${name ?? "Neighborhood"} — The Women’s Collective`;
    const description = `The Women’s Collective in ${name ?? "your neighborhood"}: one corner of our constellation, with events close to home.`;
    const raw = import.meta.env.VITE_SITE_URL as string | undefined;
    const site = parseSiteUrl(raw);
    const path = loaderData ? `/neighborhoods/${loaderData.hood.slug}` : undefined;
    const canonical = path ? canonicalTags(raw, path) : { meta: [], links: [] };
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...canonical.meta,
      ],
      links: canonical.links,
      scripts: site && path && name
        ? [jsonLdScript({ "@context": "https://schema.org", ...breadcrumbLd(site, [["Home", "/"], ["Neighborhoods", "/neighborhoods"], [name, path]]) })]
        : [],
    };
  },
  component: NeighborhoodPage,
});

const MAX_EVENTS = 3;

function NeighborhoodPage() {
  const { hood } = Route.useLoaderData();
  const [open, setOpen] = React.useState<MemberProfile | null>(null);
  const openSlug = open ? memberSlug(open) : undefined;
  const colored = hasColor(hood.color);
  const style = colored ? ({ "--hood": hood.color } as React.CSSProperties) : undefined;
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none" style={style}>
        <div className="px-(--twc-gut) py-5">
          <Link to="/neighborhoods" className="twc-link inline-flex items-center gap-2 font-plex text-xs uppercase tracking-[0.08em]">
            <Icon name="arrowLeft" />All neighborhoods
          </Link>
        </div>
        <Hero hood={hood} />
        <Members hood={hood} onOpen={setOpen} />
        <Gatherings hood={hood} />
        <section className="twc-panel twc-panel--wide twc-c-stone border-t border-sb-ink">
          <h2>Live or work in {hood.name}?</h2>
          <p className="copy">There is room in this constellation. Introduce yourself and meet the neighbors already here.</p>
          <JoinButton />
        </section>
        {/* Members only: the dialog opens directory cards, which only members and admins load. */}
        <MemberDialog member={open} onClose={() => setOpen(null)} variant="panel" tone={open ? toneFor(open.neighborhood, [hood]) : undefined}>
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

/** The band opened onto its sheet: the name on the neighborhood's colour, then its photo in a frame; without a
 *  photo, its mark (never a stand-in photo). */
function Hero({ hood }: { hood: Neighborhood }) {
  const photo = neighborhoodPhoto(hood.slug);
  const colored = hasColor(hood.color);
  const tone = colored ? textOn(hood.color) : undefined;
  const area = areaOfPlace(hood.name);
  // The card's body copy is small text: it stays on the color only where that reaches 4.5:1, else on paper.
  const cardOnColor = tone !== undefined && tone.ratio >= 4.5;
  return (
    <section
      aria-labelledby="hood-title"
      className={cn(
        "twc-hood-hero",
        colored ? "bg-(--hood)" : "border-[1.5px] border-dashed border-sb-ink/35 bg-sb-cream",
        tone?.text === "paper" ? "text-sb-paper" : "text-sb-ink",
      )}
    >
      <div
        className={cn(
          "twc-hood-hero__card",
          cardOnColor ? "bg-(--hood) px-0" : "bg-sb-paper shadow-[inset_0_0_0_1px_var(--color-sb-ink)]",
          cardOnColor && tone.text === "paper" ? "text-sb-paper" : "text-sb-ink",
        )}
      >
        <span className="twc-chip self-start">{area ? area.name : "Neighborhood"}</span>
        <h1 id="hood-title">{hood.name}</h1>
        <p className="max-w-[44ch] text-[17px]">One corner of our constellation{area ? ` in ${area.name}` : ""}, with its own color and its own people.</p>
      </div>
      {photo ? (
        <figure className="twc-map twc-hood-hero__media">
          <img
            src={photo.src}
            srcSet={photo.srcSet}
            sizes="(min-width: 69rem) 404px, calc(100vw - 58px)"
            alt={area ? `${hood.name}, ${area.borough}` : hood.name}
            width={816}
            height={816}
            fetchPriority="high"
            className="object-cover"
          />
        </figure>
      ) : (
        <HoodLogo hood={hood} sizes="(min-width: 69rem) 128px, 72px" className="size-28 justify-self-end p-5 lg:size-48 lg:p-8" />
      )}
    </section>
  );
}

function Members({ hood, onOpen }: { hood: Neighborhood; onOpen: (m: MemberProfile) => void }) {
  // The member directory is members-only (owner decision, 2026-11-24): visitors never see this section, and the
  // server's HTML never has it (the viewer is known only in the browser).
  const viewer = useQuery(viewerQuery);
  const member = viewer.data?.member === true || viewer.data?.admin === true;
  const profiles = useQuery({ ...directoryQuery, enabled: member });
  if (!member) return null;
  const members = (profiles.data ?? []).filter((m) => m.neighborhood === hood.name);
  return (
    <section aria-labelledby="hood-members" className="twc-sec">
      <div className="twc-shead">
        <h2 id="hood-members" className="twc-h2 min-w-0">Women building in {hood.name}</h2>
        <Link to="/directory" className="twc-link font-plex text-xs uppercase tracking-[0.08em]">See them in the directory <span aria-hidden>→</span></Link>
      </div>
      {profiles.isPending ? (
        <p role="status" className="text-sm text-sb-muted">Loading members…</p>
      ) : profiles.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-4 text-sm text-sb-muted">
          <p>We couldn’t load members right now.</p>
          <button type="button" className="twc-btn twc-btn--outline twc-btn--sm" onClick={() => void profiles.refetch()}>Retry</button>
        </div>
      ) : members.length === 0 ? (
        <p className="text-[15px] text-sb-muted">No one from {hood.name} is listed in the directory yet.</p>
      ) : (
        <ul className="twc-people">
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
      className="twc-person"
    >
      {member.image ? (
        <img src={member.image} alt="" loading="lazy" width={768} height={960} className="twc-person__ph" />
      ) : (
        // Initials mat, never a stand-in photo. 64px initials are large text: the pick reaches 3:1 on any color.
        <span
          aria-hidden
          className={cn(
            "twc-person__ph",
            colored ? "bg-(--hood)" : "bg-sb-cream",
            colored && textOn(hood.color).text === "paper" ? "text-sb-paper" : "text-sb-ink",
          )}
        >
          {initials(member.name)}
        </span>
      )}
      <span className="flex items-center gap-2 font-plex text-[11px] uppercase tracking-[0.08em] text-sb-muted">
        <span aria-hidden className={cn("twc-dot", colored ? "bg-(--hood)" : "border border-dashed border-sb-ink/35")} />{hood.name}
      </span>
      <span className="twc-person__name">{member.name}</span>
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
  const across = <Link to="/events" className="twc-inlink">See what’s happening across the collective <span aria-hidden>→</span></Link>;
  const list = member && events.isSuccess && here.length > 0;
  return (
    <section aria-labelledby="hood-gatherings" className="twc-sec">
      <h2 id="hood-gatherings" className="twc-h2 mb-6">Coming up in {hood.name}</h2>
      {list ? (
        <ul className="twc-evs twc-evs--list twc-bleed pb-0">
          {here.map((e) => {
            const when = eventWhen(e.starts_at);
            return (
              <li key={e.id} className="twc-ev twc-c-butter">
                <h3>{e.title}</h3>
                <p className="twc-meta"><span>{when.month} {when.day}</span><span>{when.time}</span></p>
                <p className="twc-meta">
                  {e.location && <span>{e.location}</span>}
                  <Link to="/events" className="font-semibold">Details <span aria-hidden>↗</span></Link>
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-sb-muted">
          {member && events.isSuccess
            ? <>Nothing on the {hood.name} calendar yet. {across}</>
            : member && events.isError
              ? <>We couldn’t load events right now. {across}</>
              : member && events.isPending
                ? <span role="status">Loading events…</span>
                : <>Members see what’s coming up in {hood.name} here. {across}</>}
        </p>
      )}
    </section>
  );
}
