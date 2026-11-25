import type * as React from "react";
import { Link, createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { MemberCard, formatCatalogueNumber, initials } from "@/index";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { memberPageFn } from "@/features/members/fns";
import { memberSlug } from "@/features/members/queries";
import { useNeighborhoods } from "@/features/neighborhoods/queries";
import { toneFor } from "@/features/neighborhoods/tone";

/**
 * /members/:slug ("rosa-diaz-12"): members-only (owner decision, 2026-11-24). The server decides (memberPage): a
 * listed member's page for approved members and admins, and null (404) for everyone else, so a visitor's HTML never
 * carries a member. Signing in or out re-runs the loader (the root invalidates the router), so the page follows the
 * session. Never for search engines: always noindex, no canonical and no structured data.
 */
export const Route = createFileRoute("/members_/$slug")({
  loader: async ({ params }) => {
    const page = await memberPageFn({ data: { slug: params.slug } });
    if (!page) throw notFound();
    // The catalogue number finds her; an old or hand-typed name part moves to the current one.
    const slug = memberSlug(page.member);
    if (slug && slug !== params.slug) throw redirect({ to: "/members/$slug", params: { slug }, statusCode: 301 });
    return page;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ name: "robots", content: "noindex" }] };
    const { member } = loaderData;
    const title = `${member.name} — The Women’s Collective`;
    const description = [member.role && member.business ? `${member.role} at ${member.business}` : member.role || member.business, member.neighborhood]
      .filter(Boolean).join(", ") || "A member of The Women’s Collective.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: MemberPage,
});

const safeHref = (url?: string) => (url && /^https?:\/\/\S+$/i.test(url.trim()) ? url.trim() : undefined);

function MemberPage() {
  const { member, neighbors } = Route.useLoaderData();
  const { data: hoodList = [] } = useNeighborhoods();
  const tone = toneFor(member.neighborhood, hoodList);
  const hood = hoodList.find((n) => n.name === member.neighborhood);
  const first = member.name.split(/\s+/)[0] || member.name;
  const website = safeHref(member.website);

  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <nav aria-label="Breadcrumb" className="px-(--twc-gut) py-5 font-plex text-xs uppercase leading-4 tracking-[0.08em] text-sb-muted">
          <ol className="flex flex-wrap gap-1.5">
            <li><Link to="/directory" className="twc-link text-sb-blue-ink">Directory</Link></li>
            <li aria-current="page"><span aria-hidden>/ </span>{member.name}</li>
          </ol>
        </nav>

        <section className="twc-sec" style={tone ? ({ "--hood": tone.color } as React.CSSProperties) : undefined}>
          <div className="twc-split twc-split--aside items-start">
            <figure className="m-0 w-full max-w-[320px]">
              <div className={`twc-hardphoto aspect-[4/5] overflow-hidden ${tone ? "bg-(--hood)" : "bg-sb-cream"}`}>
                {member.image ? (
                  <img src={member.image} alt={member.imageAlt ?? ""} width={768} height={960} fetchPriority="high" className="size-full object-cover" />
                ) : (
                  <span aria-hidden className="grid size-full place-items-center font-display text-8xl font-extrabold leading-none text-sb-ink [font-stretch:75%]">{initials(member.name)}</span>
                )}
              </div>
              <figcaption className="mt-4 font-plex text-[11px] uppercase tracking-[0.08em] text-sb-muted">{[first, member.neighborhood].filter(Boolean).join(", ")}</figcaption>
            </figure>

            <div className="flex min-w-0 flex-col gap-5">
              <p className="flex flex-wrap items-center gap-2 font-plex text-xs uppercase leading-4 tracking-[0.08em] text-sb-muted">
                {tone && <span aria-hidden className="twc-dot bg-(--hood)" />}
                {member.catalogueNumber !== undefined && <span>Nº {formatCatalogueNumber(member.catalogueNumber)}</span>}
                {member.catalogueNumber !== undefined && member.neighborhood && <span aria-hidden>·</span>}
                {member.neighborhood && <span>{member.neighborhood}</span>}
              </p>
              <h1 className="twc-display break-words">{member.name}</h1>
              {(member.role || member.business) && (
                <p className="text-[22px] leading-[1.35]">
                  {member.role}
                  {member.role && member.business && " at "}
                  {member.business && <strong className="font-semibold">{member.business}</strong>}
                </p>
              )}
              {(member.logo || member.specialty) && (
                <div className="flex items-center gap-3.5">
                  {member.logo && (
                    <img src={member.logo} alt={`${member.business || member.name} logo`} width={56} height={56} className="size-14 shrink-0 rounded-(--twc-radius-flag) object-contain" />
                  )}
                  {member.specialty && <span className="twc-chip twc-chip--ring">{member.specialty}</span>}
                </div>
              )}
              {member.bio.trim() && (
                <section className="mt-1.5 flex flex-col gap-2.5 border-t border-sb-ink pt-4">
                  <h2 className="twc-eyebrow text-sb-ink">In her words</h2>
                  <p className="twc-measure whitespace-pre-line text-[17px] leading-[1.6]">{member.bio}</p>
                </section>
              )}
              {member.lookingFor.trim() && (
                <div className="flex flex-col gap-1.5 bg-sb-cream px-6 py-5">
                  <span className="twc-eyebrow text-sb-ink">Looking to meet</span>
                  <span className="text-[20px] font-semibold leading-[1.35]">{member.lookingFor}</span>
                </div>
              )}
              {website && (
                <div className="mt-1 flex flex-wrap gap-2.5">
                  <a href={website} target="_blank" rel="noopener noreferrer" className="twc-btn twc-btn--outline">
                    Website <span className="twc-arrow" aria-hidden>↗</span><span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="twc-panel twc-panel--wide twc-c-band-butter border-t border-sb-ink">
          <h2>Want an introduction?</h2>
          <p className="copy">Members can ask us to connect them with {first} directly. We’ll make the intro by email.</p>
          <Link to="/contact" className="twc-btn">Ask for an introduction <span className="twc-arrow" aria-hidden>→</span></Link>
        </section>

        {neighbors.length > 0 && (
          <section className="twc-sec">
            <div className="twc-shead">
              <h2 className="twc-h2 min-w-0">More neighbors from {member.neighborhood}</h2>
              {hood && (
                <Link to="/neighborhoods/$slug" params={{ slug: hood.slug }} className="twc-link font-plex text-xs uppercase leading-5 tracking-[0.08em]">
                  See all of {hood.name} <span aria-hidden>→</span>
                </Link>
              )}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(200px,100%),1fr))] gap-6">
              {neighbors.map((m) => {
                const slug = memberSlug(m);
                const card = <MemberCard member={m} variant="grid" />;
                return slug ? (
                  <Link key={m.id} to="/members/$slug" params={{ slug }} className="block rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-sb-ink">
                    {card}
                  </Link>
                ) : <div key={m.id}>{card}</div>;
              })}
            </div>
          </section>
        )}
      </main>
      <AppFooter />
    </AppPage>
  );
}
