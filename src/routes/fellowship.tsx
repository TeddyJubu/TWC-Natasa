import { Link, createFileRoute } from "@tanstack/react-router";
import membersGathering from "@/assets/photography/site/members-gathering.webp";
import { membersGatheringSizes, membersGatheringSrcSet } from "@/app/responsive-images";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Icon, JoinButton } from "@/app/layout/twc";

const TITLE = "The Fellowship — The Women’s Collective";
const DESCRIPTION = "Membership in The Women’s Collective: a directory of women across North Brooklyn and Queens, the events that bring them together, and a real person who reads every application.";

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
  { field: "twc-c-sage", title: "Your card", text: "Show up in the member directory if you want to. You decide who sees it: other members, or no one yet. The directory is for members only." },
  { field: "twc-c-butter", title: "Events", text: "Approved members save a seat at events from their account, and meet the neighbors we introduce them to." },
  { field: "twc-c-tomato", title: "Your number", text: "Approval brings your catalogue number: the small, permanent mark of being part of the collective." },
];

function FellowshipPage() {
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <section className="twc-phd twc-phd--media">
          <div className="min-w-0">
            <p className="twc-eyebrow">Membership</p>
            <h1 className="twc-display">The Fellowship.</h1>
            <p className="twc-lede">Read by a person, and small enough that people recognize each other.</p>
            <p className="twc-chip twc-chip--ring mt-6"><Icon name="pin" />North Brooklyn and Queens, New York</p>
          </div>
          <figure className="twc-phd__media twc-phd__media--wide">
            <img src={membersGathering} srcSet={membersGatheringSrcSet} sizes={membersGatheringSizes} alt="Two women in conversation at a stylish indoor event, holding wine glasses" width={1600} height={1069} fetchPriority="high" className="twc-hardphoto aspect-[3/2]" />
          </figure>
        </section>

        <section aria-labelledby="what-title" className="twc-sec">
          <div className="twc-split">
            <div className="flex min-w-0 flex-col gap-3">
              <p className="twc-eyebrow">What it is</p>
              <h2 id="what-title" className="twc-h2">A directory, and the people behind it.</h2>
            </div>
            <div className="flex min-w-0 flex-col gap-4 text-[17px] leading-[1.6]">
              <p>At its simplest, The Women’s Collective is a list of women across North Brooklyn and Queens: what they do, what they’re building, and the card they choose to share.</p>
              <p>What makes it worth joining is the part that isn’t a list: events, and a group of people who answer when you write to them. The only thing membership asks of you is that you participate.</p>
              <p>
                Wondering whether it’s for you? <Link to="/faq" hash="membership" className="twc-inlink">Who the collective is for</Link> is on the questions page.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="gives-title">
          <div className="twc-sec twc-sec--tight">
            <div className="twc-shead mb-0">
              <h2 id="gives-title" className="twc-h2">Three small things, kept well.</h2>
              <p className="twc-meta">What you get</p>
            </div>
          </div>
          <ul className="twc-steps twc-steps--3">
            {GIVES.map((s, i) => (
              <li key={s.title} className={`twc-tile ${s.field}`}>
                <div>
                  <span className="no">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{s.title}</h3>
                </div>
                <p>{s.text}</p>
              </li>
            ))}
          </ul>
          <p className="twc-sec twc-sec--tight m-0 text-[17px]">
            The path in is short: apply, a real person reads it, and we write back. <Link to="/about" className="twc-inlink">See how it works</Link>.
          </p>
        </section>

        <section aria-labelledby="principles-title" className="twc-sec twc-c-ink">
          <div className="twc-split">
            <div className="flex min-w-0 flex-col gap-3">
              <p className="twc-eyebrow text-sb-paper">Community principles</p>
              <h2 id="principles-title" className="twc-h2">What we expect of each other.</h2>
            </div>
            <div className="flex min-w-0 flex-col gap-4 text-[17px] leading-[1.6]">
              <p>Show up. Give first. Say the real thing rather than the polished thing. Keep what’s said in a room in that room unless you’re told otherwise.</p>
              <p>And the one that matters most: the directory is not a mailing list. Members’ details are there so people can connect, never so anyone can broadcast. No bulk outreach, no cold pitching, no adding people to lists they didn’t join.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="ask-title" className="twc-sec">
          <div className="twc-shead mb-0">
            <div className="flex min-w-0 flex-col gap-3">
              <p className="twc-eyebrow">Still wondering?</p>
              <h2 id="ask-title" className="twc-h3">Ask before you apply.</h2>
              <p className="twc-lede">If your question isn’t on the questions page, ask us directly. We’d rather answer it than have you guess.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/faq" className="twc-btn twc-btn--outline">Read the questions <Icon name="arrow" className="twc-arrow" /></Link>
              <Link to="/contact" className="twc-btn twc-btn--outline">Write to us <Icon name="arrow" className="twc-arrow" /></Link>
            </div>
          </div>
        </section>

        <section className="twc-duo border-t border-sb-ink">
          <div className="twc-panel twc-c-band-butter">
            <p className="twc-eyebrow text-sb-ink">The next step</p>
            <h2>A real person reads every application.</h2>
            <p className="copy">Tell us about your work and who you hope to meet.</p>
            <JoinButton />
          </div>
          <div className="twc-panel twc-c-sky">
            <p className="twc-eyebrow text-sb-ink">North Brooklyn &amp; Queens</p>
            <h2>Prefer to see us first?</h2>
            <p className="copy">Come to something.</p>
            <Link to="/events" className="twc-btn">Come to something first <Icon name="arrow" className="twc-arrow" /></Link>
          </div>
        </section>
      </main>
      <AppFooter />
    </AppPage>
  );
}
