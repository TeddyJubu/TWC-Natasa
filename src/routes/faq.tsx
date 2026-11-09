import { Link, createFileRoute } from "@tanstack/react-router";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Icon } from "@/app/layout/twc";

type Answer = { q: string; a: string; link?: { text: string; to: "/contact" | "/privacy"; after: string } };
type Group = { id: string; title: string; items: Answer[] };

// Answers reuse copy already on the site (home FAQ, sign-up, account and application). Questions with
// no settled answer yet (membership fee, whether the headshot session is paid, guests) are left out.
const FAQ_GROUPS: Group[] = [
  {
    id: "membership",
    title: "Membership",
    items: [
      { q: "Who is the collective for?", a: "Women in Queens who are building something — a business, a career, a creative practice — and want real relationships close to home. Founders, freelancers, makers, and the newly curious are all welcome. No follower count or pitch deck required." },
      { q: "Which neighborhoods are included?", a: "Long Island City, Astoria, Sunnyside, Woodside, Jackson Heights, Elmhurst, East Elmhurst, Forest Hills, Rego Park, and surrounding Queens neighborhoods." },
      { q: "Is the community inclusive?", a: "Yes. We welcome women from all backgrounds, including moms, married and single women, LGBTQ+ members, non-binary people who feel aligned with the community, immigrants, international members, and people from diverse cultures." },
      { q: "What happens after I apply?", a: "A real person in Queens reads every application. We’ll be in touch by email about next steps." },
      { q: "Can I create an account before I’m approved?", a: "Yes. Create your login now; your profile unlocks once the collective approves your application." },
    ],
  },
  {
    id: "profile",
    title: "Your profile",
    items: [
      { q: "Who can see my profile?", a: "You decide. Turn on “Show me in the member directory” and other members can see your card. Turn on “Show my profile on the public website” as well and anyone can see it on our homepage and member page. Neither goes live until you’re approved." },
      { q: "When do I get my catalogue number?", a: "It’s assigned once you’re approved." },
      { q: "Can I change my card later?", a: "Any time, from your account page. Short and warm beats long and formal." },
    ],
  },
  {
    id: "headshots",
    title: "Headshots",
    items: [
      { q: "Do I need an official headshot?", a: "Only if you’re approved for the public member directory. Directory portraits come from a session with the collective’s official photographer, so every card feels consistent. Personal or previously taken headshots cannot be used." },
    ],
  },
  {
    id: "gatherings",
    title: "Gatherings",
    items: [
      { q: "Who can come to gatherings?", a: "Approved members save a seat from their account." },
      { q: "Can I host or sponsor one?", a: "We’d love that. Tell us on your application, or ", link: { text: "get in touch", to: "/contact", after: "." } },
    ],
  },
  {
    id: "privacy",
    title: "Privacy",
    items: [
      { q: "What do you do with my information?", a: "We use it to review applications, keep in touch, run programs and events, schedule headshots, and — only with your permission — create directory listings and spotlights. Private information is not intentionally published. The full story is in our ", link: { text: "privacy policy", to: "/privacy", after: "." } },
    ],
  },
];

const plain = (item: Answer) => item.a + (item.link ? item.link.text + item.link.after : "");

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_GROUPS.flatMap((g) => g.items).map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: plain(item) },
  })),
};

const TITLE = "Questions — The Women’s Collective";
const DESCRIPTION = "Answers about membership, profiles, headshots, gatherings and privacy at The Women’s Collective in Western Queens.";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    // A data block, never executed; the CSP's script-src allows inline scripts anyway.
    scripts: [{ type: "application/ld+json", children: JSON.stringify(FAQ_LD) }],
  }),
  component: FaqPage,
});

// Numbers run across the whole page, so each topic starts where the previous one stopped.
const starts = FAQ_GROUPS.map((_, i) => 1 + FAQ_GROUPS.slice(0, i).reduce((n, g) => n + g.items.length, 0));
const no = (n: number) => String(n).padStart(2, "0");

function FaqPage() {
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <section className="twc-wrap flex flex-wrap items-start gap-x-16 gap-y-12 pb-[88px] pt-[72px]">
          <div className="flex min-w-0 max-w-[380px] flex-[1_1_300px] flex-col gap-5">
            <p className="twc-eyebrow-script">a collective for queens</p>
            <h1 className="twc-h2">Questions, answered.</h1>
            <p className="text-[17px] leading-[1.65] text-sb-muted">Everything you might wonder before you apply, and after you’re in.</p>
            <nav aria-labelledby="toc-h" className="mt-3 flex flex-col gap-3">
              <span id="toc-h" className="twc-eyebrow">Topics</span>
              <div className="flex flex-col">
                {FAQ_GROUPS.map((g, i) => (
                  <a key={g.id} href={`#${g.id}`} className="twc-link flex items-center gap-3 border-b border-sb-ink/15 py-3 font-display text-[17px] leading-[1.3] no-underline first:border-t">
                    <span className="twc-index min-w-[22px]">{no(starts[i])}</span>{g.title}
                  </a>
                ))}
              </div>
            </nav>
          </div>

          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-11">
            {FAQ_GROUPS.map((g, gi) => (
              <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`} className="flex scroll-mt-[100px] flex-col gap-3">
                <h2 id={`${g.id}-h`} className="twc-eyebrow pl-8 max-md:pl-4">{g.title}</h2>
                <div>
                  {g.items.map((item, i) => (
                    <details key={item.q} name="faq" open={gi === 0 && i === 0} className="twc-faq">
                      <summary>
                        <span className="twc-index">{no(starts[gi] + i)}</span>
                        <span className="twc-faq__q">{item.q}</span>
                        <span className="twc-faq__toggle"><Icon name="plus" /></span>
                      </summary>
                      <p className="twc-faq__a">
                        {item.a}
                        {item.link && <><Link to={item.link.to} className="twc-inlink">{item.link.text}</Link>{item.link.after}</>}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="twc-wrap pb-[104px]">
          <div className="twc-ticket bg-[linear-gradient(160deg,#16213f_0%,#0b0b0a_100%)]">
            <div className="twc-ticket__main">
              <p className="twc-eyebrow-script">ask us directly</p>
              <h2 className="twc-display md:text-[72px]">Still wondering?</h2>
            </div>
            <div className="twc-ticket__stub">
              <div className="twc-ticket__meta"><span>Admit one</span><span>Nº 0001 — Queens</span></div>
              <p className="text-base leading-[1.6] text-sb-paper/85">A real person in Queens reads every note.</p>
              <div className="flex flex-wrap gap-2.5">
                <Link to="/contact" className="twc-btn twc-btn--sun">Contact us <Icon name="arrow" className="twc-arrow" /></Link>
                <Link to="/join" className="twc-btn twc-btn--paper">Start your application <Icon name="arrow" className="twc-arrow" /></Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <AppFooter />
    </AppPage>
  );
}
