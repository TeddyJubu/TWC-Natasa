import { Link, createFileRoute } from "@tanstack/react-router";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Icon, JoinButton } from "@/app/layout/twc";

type Answer = { q: string; a: string; link?: { text: string; to: "/contact"; after: string } };
type Group = { id: string; title: string; items: Answer[] };

// Answers reuse copy already on the site (home FAQ, sign-up, account and application). Questions with
// no settled answer yet (membership fee, whether the headshot session is paid, guests) are left out.
const FAQ_GROUPS: Group[] = [
  {
    id: "membership",
    title: "Membership",
    items: [
      { q: "Who is the collective for?", a: "Women in North Brooklyn and Queens who are building something — a business, a career, a creative practice — and want real relationships close to home. Founders, freelancers, makers, and the newly curious are all welcome. No follower count or pitch deck required." },
      { q: "Which neighborhoods are included?", a: "In North Brooklyn: Greenpoint, Williamsburg and Bushwick. In Queens: Long Island City, Astoria, Sunnyside, Woodside, Jackson Heights, Elmhurst, East Elmhurst, Forest Hills and Rego Park. Surrounding neighborhoods are welcome too." },
      { q: "Is the community inclusive?", a: "Yes. We welcome women from all backgrounds, including moms, married and single women, LGBTQ+ members, non-binary people who feel aligned with the community, immigrants, international members, and people from diverse cultures." },
      { q: "What happens after I apply?", a: "A real person reads every application. We’ll be in touch by email about next steps." },
      { q: "Can I create an account before I’m approved?", a: "Yes. Create your login now; your profile unlocks once the collective approves your application." },
    ],
  },
  {
    id: "profile",
    title: "Your profile",
    items: [
      { q: "Who can see my profile?", a: "Only members. After you’re approved, turn on “Show me in the member directory” and other members can see your card. The directory is for members only, so your card is never on the public website. Until you turn it on, only you and the admins can see your card." },
      { q: "When do I get my catalogue number?", a: "It’s assigned once you’re approved." },
      { q: "Can I change my card later?", a: "Any time, from your account page. Short and warm beats long and formal." },
    ],
  },
  {
    id: "headshots",
    title: "Headshots",
    items: [
      { q: "Do I need an official headshot?", a: "Only if you’re approved for the member directory. Directory portraits come from a session with the collective’s official photographer, so every card feels consistent. Personal or previously taken headshots cannot be used." },
    ],
  },
  {
    id: "events",
    title: "Events",
    items: [
      { q: "Who can come to events?", a: "Approved members save a seat from their account." },
      { q: "Can I host or sponsor one?", a: "We’d love that. Tell us on your application, or ", link: { text: "get in touch", to: "/contact", after: "." } },
    ],
  },
  {
    id: "privacy",
    title: "Privacy",
    items: [
      { q: "What do you do with my information?", a: "We use it to review applications, keep in touch, run programs and events, schedule headshots, and — only with your permission — create directory listings and spotlights. Private information is not intentionally published." },
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
const DESCRIPTION = "Answers about membership, profiles, headshots, events and privacy at The Women’s Collective in North Brooklyn and Queens.";

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
        <section className="twc-phd">
          <div className="min-w-0">
            <p className="twc-eyebrow">A collective close to home</p>
            <h1 className="twc-display">Questions, answered.</h1>
            <p className="twc-lede">Everything you might wonder before you apply, and after you’re in.</p>
          </div>
        </section>

        <section className="twc-sec">
          <div className="twc-split--aside twc-split">
            <nav aria-labelledby="toc-h" className="flex flex-col gap-3 lg:sticky lg:top-28">
              <span id="toc-h" className="twc-eyebrow">Topics</span>
              <ul className="twc-toc">
                {FAQ_GROUPS.map((g, i) => (
                  <li key={g.id}>
                    <a href={`#${g.id}`}><span className="twc-index">{no(starts[i])}</span>{g.title}</a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="twc-faqs flex min-w-0 flex-col gap-12">
              {FAQ_GROUPS.map((g, gi) => (
                <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`} className="flex scroll-mt-[100px] flex-col">
                  <h2 id={`${g.id}-h`} className="twc-eyebrow text-sb-ink">{g.title}</h2>
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
          </div>
        </section>

        <section className="twc-panel twc-panel--wide twc-c-lilac border-t border-sb-ink">
          <p className="twc-eyebrow text-sb-ink">Ask us directly</p>
          <h2>Still wondering?</h2>
          <p className="copy">A real person reads every note.</p>
          <div className="twc-panel__acts">
            <Link to="/contact" className="twc-btn">Contact us <Icon name="arrow" className="twc-arrow" /></Link>
            <JoinButton />
          </div>
        </section>
      </main>
      <AppFooter />
    </AppPage>
  );
}
