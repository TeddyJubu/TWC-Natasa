import type * as React from "react";
import { Link, createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { MemberCard, formatCatalogueNumber, initials } from "@/index";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Scallop } from "@/app/layout/twc";
import { memberPageFn } from "@/features/members/fns";
import { memberSlug } from "@/features/members/queries";
import { breadcrumbLd, canonicalTags, jsonLdScript, parseSiteUrl } from "@/app/seo";
import { useNeighborhoods } from "@/features/neighborhoods/queries";
import { toneFor } from "@/features/neighborhoods/tone";

/**
 * /members/:slug ("rosa-diaz-12"). The server decides who sees what (memberPage): a public profile for anyone,
 * a listed member's page for approved members and admins only, and null (404) for everything else. Signing in
 * or out re-runs the loader (the root invalidates the router), so the page follows the session.
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
    if (!loaderData) return {};
    const { member, isPublic } = loaderData;
    const title = `${member.name} — The Women’s Collective`;
    const description = [member.role && member.business ? `${member.role} at ${member.business}` : member.role || member.business, member.neighborhood]
      .filter(Boolean).join(", ") || "A member of The Women’s Collective in Queens.";
    // Only a public page gets a canonical and structured data; a members-only one stays noindex without them.
    const raw = import.meta.env.VITE_SITE_URL as string | undefined;
    const site = parseSiteUrl(raw);
    const path = `/members/${memberSlug(member)}`;
    const canonical = isPublic ? canonicalTags(raw, path) : { meta: [], links: [] };
    // Only facts she published on her card; a missing one is left out, never filled in.
    const person = {
      "@type": "Person",
      name: member.name,
      ...(member.role ? { jobTitle: member.role } : {}),
      ...(member.business ? { worksFor: { "@type": "Organization", name: member.business } } : {}),
      ...(member.neighborhood ? { homeLocation: { "@type": "Place", name: member.neighborhood } } : {}),
    };
    const scripts = isPublic && site
      ? [jsonLdScript({
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "ProfilePage", url: site + path, mainEntity: person },
            breadcrumbLd(site, [["Home", "/"], ["Members", "/members"], [member.name, path]]),
          ],
        })]
      : [];
    return {
      links: canonical.links,
      scripts,
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
        // A members-only page (listed, not public) is never for search engines.
        ...(isPublic ? [] : [{ name: "robots", content: "noindex" }]),
        ...canonical.meta,
      ],
    };
  },
  component: MemberPage,
});

const safeHref = (url?: string) => (url && /^https?:\/\/\S+$/i.test(url.trim()) ? url.trim() : undefined);

function MemberPage() {
  const { member, neighbors, audience } = Route.useLoaderData();
  const { data: hoodList = [] } = useNeighborhoods();
  const tone = toneFor(member.neighborhood, hoodList);
  const hood = hoodList.find((n) => n.name === member.neighborhood);
  const first = member.name.split(/\s+/)[0] || member.name;
  const website = safeHref(member.website);

  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <nav aria-label="Breadcrumb" className="twc-wrap pt-7 font-fragment text-xs uppercase leading-4 tracking-[1px] text-sb-muted">
          <ol className="flex flex-wrap gap-1.5">
            <li><Link to="/members" className="twc-link text-sb-blue-ink">Members</Link></li>
            <li aria-current="page"><span aria-hidden>/ </span>{member.name}</li>
          </ol>
        </nav>

        <section className="twc-wrap flex flex-wrap items-start gap-16 pb-24 pt-12 max-sm:gap-10" style={tone ? ({ "--hood": tone.color } as React.CSSProperties) : undefined}>
          <div className="flex min-w-0 flex-[1_1_340px] justify-center pt-3">
            <figure className="twc-polaroid w-[420px] -rotate-4 p-4 pb-5">
              <div className={`relative aspect-[4/5] overflow-hidden ${tone ? "bg-(--hood)" : "bg-sb-cream"}`}>
                {member.image ? (
                  <img src={member.image} alt={member.imageAlt ?? ""} width={768} height={960} fetchPriority="high" className="size-full object-cover" />
                ) : (
                  <span aria-hidden className="grid size-full place-items-center font-display text-8xl leading-none text-sb-ink">{initials(member.name)}</span>
                )}
              </div>
              <figcaption className="text-[32px]">{[first, member.neighborhood].filter(Boolean).join(", ")}</figcaption>
            </figure>
          </div>

          <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-5.5">
            <p className="flex flex-wrap items-center gap-2 font-fragment text-xs uppercase leading-4 tracking-[1px] text-sb-muted">
              {tone && <span aria-hidden className="twc-dot bg-(--hood)" />}
              {member.catalogueNumber !== undefined && <span>Nº {formatCatalogueNumber(member.catalogueNumber)}</span>}
              {member.catalogueNumber !== undefined && member.neighborhood && <span aria-hidden>·</span>}
              {member.neighborhood && <span>{member.neighborhood}</span>}
            </p>
            <h1 className="twc-display md:text-[72px]">{member.name}</h1>
            {(member.role || member.business) && (
              <p className="font-display text-[22px] leading-[1.4]">
                {member.role}
                {member.role && member.business && " at "}
                {member.business && <strong className="font-normal text-sb-blue-ink">{member.business}</strong>}
              </p>
            )}
            {(member.logo || member.specialty) && (
              <div className="flex items-center gap-3.5">
                {member.logo && (
                  <img src={member.logo} alt={`${member.business || member.name} logo`} width={56} height={56} className="size-14 shrink-0 rounded-[6px] object-contain" />
                )}
                {member.specialty && <span className="text-[15px] text-sb-muted">{member.specialty}</span>}
              </div>
            )}
            {member.bio.trim() && (
              <section className="mt-1.5 flex flex-col gap-2.5">
                <h2 className="twc-eyebrow">In her words</h2>
                <p className="text-[17px] leading-[1.65]">{member.bio}</p>
              </section>
            )}
            {member.lookingFor.trim() && (
              <div className="flex flex-col gap-1.5 rounded-[6px] bg-sb-cream px-6 py-5">
                <span className="twc-eyebrow text-sb-ink">Looking to meet</span>
                <span className="font-display text-[22px] leading-[1.35]">{member.lookingFor}</span>
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
        </section>

        <Scallop from="#fcfcfa" to="#edd22e" />
        <section className="twc-band twc-band--sun pb-22 pt-16">
          <div className="twc-wrap flex flex-wrap items-center justify-between gap-x-10 gap-y-6">
            <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-3">
              <h2 className="twc-h3">Want an introduction?</h2>
              <p className="max-w-[560px] text-[17px]">Members can ask us to connect them with {first} directly. We’ll make the intro by email.</p>
            </div>
            {audience === "member" ? (
              <Link to="/contact" className="twc-btn">Ask for an introduction <span className="twc-arrow" aria-hidden>→</span></Link>
            ) : audience === "pending" ? (
              <p className="max-w-[320px] text-[17px]">Introductions open once you’re welcomed in.</p>
            ) : (
              <Link to="/auth" className="twc-btn">Sign in to ask for an intro <span className="twc-arrow" aria-hidden>→</span></Link>
            )}
          </div>
        </section>
        <Scallop from="#edd22e" to="#fcfcfa" />

        {neighbors.length > 0 && (
          <section className="twc-wrap flex flex-col gap-8 pb-24 pt-18">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="twc-h3 min-w-0 md:text-[44px]">More neighbors from {member.neighborhood}</h2>
              {hood && (
                <Link to="/neighborhoods/$slug" params={{ slug: hood.slug }} className="twc-link font-display text-[13px] uppercase leading-5 tracking-[1.6px] text-sb-blue-ink">
                  See all of {hood.name} <span aria-hidden>→</span>
                </Link>
              )}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-6">
              {neighbors.map((m) => {
                const slug = memberSlug(m);
                const card = <MemberCard member={m} variant="polaroid" tone={toneFor(m.neighborhood, hoodList)} />;
                return slug ? (
                  <Link key={m.id} to="/members/$slug" params={{ slug }} className="block rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-sb-blue-ink">
                    {card}
                  </Link>
                ) : <div key={m.id}>{card}</div>;
              })}
            </div>
          </section>
        )}
        {neighbors.length === 0 && <div className="h-12" />}
      </main>
      <AppFooter />
    </AppPage>
  );
}
