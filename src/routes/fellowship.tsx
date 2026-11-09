import { Link, createFileRoute } from "@tanstack/react-router";
import membersGathering from "@/assets/photography/site/members-gathering.webp";
import gatheringSupper from "@/assets/photography/site/gathering-supper.webp";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Icon, Scallop, TwcRibbon } from "@/app/layout/twc";
import { useNeighborhoods } from "@/features/neighborhoods/queries";

const TITLE = "The Fellowship — The Women’s Collective";
const DESCRIPTION = "Membership in The Women’s Collective: a directory of women across Western Queens, the gatherings that bring them together, and a real person who reads every application.";

export const Route = createFileRoute("/fellowship")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FellowshipPage,
});

// Only what the live app already promises (/faq, /about, /account). Fees, review times, eligibility and
// reapplication rules have no settled wording yet, so they are not stated here (SITE-037/038/040).
const GIVES = [
  { tone: "twc-stamp--olive", title: "Your card", text: "Show up in the member directory if you want to. You decide who sees it: other members, the public website, or no one yet." },
  { tone: "twc-stamp--mustard", title: "Gatherings", text: "Approved members save a seat at gatherings from their account, and meet the neighbors we introduce them to." },
  { tone: "twc-stamp--terracotta", title: "Your number", text: "Approval brings your catalogue number: the small, permanent mark of being part of the collective." },
];

function FellowshipPage() {
  const { data: neighborhoods } = useNeighborhoods();
  const hoods = neighborhoods.filter((n) => n.active);
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <section className="twc-wrap flex flex-wrap items-center gap-14 pb-[88px] pt-[72px]">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5">
            <p className="twc-eyebrow-script">membership</p>
            <h1 className="twc-display">The Fellowship.</h1>
            <p className="twc-lede max-w-[560px]">Read by a person, and small enough that people recognize each other.</p>
            <p className="twc-chip twc-chip--ring self-start"><Icon name="pin" />Western Queens, New York</p>
          </div>
          <div className="relative min-h-[380px] min-w-0 flex-[1_1_380px]">
            <img src={membersGathering} alt="Two women in conversation at a stylish indoor gathering, holding wine glasses" width={1600} height={1069} fetchPriority="high" className="twc-photo twc-photo--arch absolute left-0 top-0 aspect-[5/6] w-[min(300px,80%)]" />
            <figure className="twc-polaroid absolute -bottom-2.5 right-0 w-[min(220px,58%)]">
              <img src={gatheringSupper} alt="A candle-lit supper with a group of women smiling and chatting" width={1600} height={1067} loading="lazy" />
              <figcaption>around the table</figcaption>
            </figure>
          </div>
        </section>

        <div className="pb-9 pt-3">
          <TwcRibbon items={hoods.map((n) => n.name)} label="Pause the neighborhood ribbon" />
        </div>

        <Scallop from="#fcfcfa" to="#f3f0e8" />
        <section className="twc-band twc-band--cream">
          <div className="twc-wrap flex max-w-[820px] flex-col gap-[18px]">
            <p className="twc-eyebrow">What it is</p>
            <h2 className="twc-h3">A directory, and the people behind it.</h2>
            <p className="text-[17px] leading-[1.65] text-sb-muted">At its simplest, The Women’s Collective is a list of women across Western Queens: what they do, what they’re building, and the card they choose to share.</p>
            <p className="text-[17px] leading-[1.65] text-sb-muted">What makes it worth joining is the part that isn’t a list: gatherings, and a group of people who answer when you write to them. The only thing membership asks of you is that you participate.</p>
            <p className="text-[17px] leading-[1.65] text-sb-muted">
              Wondering whether it’s for you? <Link to="/faq" hash="membership" className="twc-inlink">Who the collective is for</Link> is on the questions page.
            </p>
          </div>
        </section>
        <Scallop from="#f3f0e8" to="#fcfcfa" />

        <section aria-labelledby="gives-title" className="twc-wrap flex flex-col gap-9 pb-[104px] pt-[88px]">
          <div className="flex flex-col gap-2">
            <p className="twc-eyebrow-script">what you get</p>
            <h2 id="gives-title" className="twc-h2">Three small things, kept well.</h2>
          </div>
          <ul className="twc-stamp-grid m-0 list-none grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))]">
            {GIVES.map((s, i) => (
              <li key={s.title} className={`twc-stamp ${s.tone}`}>
                <span className="twc-index">0{i + 1}</span>
                <div className="flex flex-col gap-2.5">
                  <h3 className="text-[32px]">{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[17px] text-sb-muted">
            The path in is short: apply, a real person reads it, and we write back. <Link to="/about" className="twc-inlink">See how it works</Link>.
          </p>
        </section>

        <Scallop from="#fcfcfa" to="#0b0b0a" />
        <section aria-labelledby="principles-title" className="twc-band twc-band--night">
          <div className="twc-wrap flex max-w-[820px] flex-col items-start gap-[18px]">
            <p className="twc-eyebrow text-sb-paper/60">Community principles</p>
            <h2 id="principles-title" className="twc-h3">What we expect of each other.</h2>
            <p className="text-[17px] leading-[1.65] text-sb-paper/80">Show up. Give first. Say the real thing rather than the polished thing. Keep what’s said in a room in that room unless you’re told otherwise.</p>
            <p className="text-[17px] leading-[1.65] text-sb-paper/80">And the one that matters most: the directory is not a mailing list. Members’ details are there so people can connect, never so anyone can broadcast. No bulk outreach, no cold pitching, no adding people to lists they didn’t join.</p>
            <Link to="/code-of-conduct" className="twc-btn twc-btn--sun mt-1.5">Read the code of conduct <Icon name="arrow" className="twc-arrow" /></Link>
          </div>
        </section>
        <Scallop from="#0b0b0a" to="#fcfcfa" />

        <section aria-labelledby="ask-title" className="twc-wrap flex flex-wrap items-end justify-between gap-8 pb-12 pt-[88px]">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-3">
            <p className="twc-eyebrow-script">still wondering?</p>
            <h2 id="ask-title" className="twc-h3">Ask before you apply.</h2>
            <p className="max-w-[560px] text-sb-muted">If your question isn’t on the questions page, ask us directly. We’d rather answer it than have you guess.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/faq" className="twc-btn twc-btn--outline">Read the questions <Icon name="arrow" className="twc-arrow" /></Link>
            <Link to="/contact" className="twc-btn twc-btn--outline">Write to us <Icon name="arrow" className="twc-arrow" /></Link>
          </div>
        </section>

        <section className="twc-wrap pb-[104px] pt-12">
          <div className="twc-ticket bg-[linear-gradient(160deg,#16213f_0%,#0b0b0a_100%)]">
            <div className="twc-ticket__main">
              <p className="twc-eyebrow-script">psst — the next step</p>
              <h2 className="twc-display">A real person reads every application.</h2>
            </div>
            <div className="twc-ticket__stub">
              <div className="twc-ticket__meta"><span>Admit one</span><span>Western Queens</span></div>
              <p className="text-base leading-[1.6] text-sb-paper/85">Tell us about your work and who you hope to meet. Prefer to see us first? Come to something.</p>
              <div className="flex flex-col gap-3">
                <Link to="/join" className="twc-btn twc-btn--paper">Start your application <Icon name="arrow" className="twc-arrow" /></Link>
                <Link to="/gatherings" className="twc-btn twc-btn--outline !text-sb-paper">Come to something first <Icon name="arrow" className="twc-arrow" /></Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <AppFooter />
    </AppPage>
  );
}
