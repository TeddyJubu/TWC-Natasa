import { Link, createFileRoute } from "@tanstack/react-router";
import gatheringCeramics from "@/assets/photography/site/gathering-ceramics.webp";
import { gatheringCeramicsSizes, gatheringCeramicsSrcSet } from "@/app/responsive-images";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Icon, Scallop } from "@/app/layout/twc";
import { PartnershipForm } from "@/features/contact/PartnershipForm";
import { FormCopyProvider } from "@/features/form-copy/FormCopy";
import { loadFormCopy } from "@/features/form-copy/queries";

const TITLE = "Partnerships — The Women’s Collective";
const DESCRIPTION = "Host, teach, supply or support: partner with The Women’s Collective in Western Queens. Neither of us is buying anything.";

export const Route = createFileRoute("/partnerships")({
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
  loader: () => loadFormCopy("partnership"),
  component: PartnershipsPage,
});

// No "who we work with now" block and no prices: partner facts have not been re-supplied (SITE-043/157).
const WAYS = [
  { tone: "twc-stamp--olive", kind: "Host", title: "Open your space", text: "A studio, a shop floor, a back room, a rooftop. You provide the room; we handle invitations, RSVPs, and everything on the night. Most partnerships start here." },
  { tone: "twc-stamp--mustard", kind: "Teach", title: "Share what you know", text: "A class, a workshop, a demonstration, or forty minutes on the thing you’re genuinely expert in. Not a pitch with a discount code at the end: the actual knowledge." },
  { tone: "", kind: "Supply", title: "Feed the room", text: "Food, coffee, flowers, wine. Paid at cost or contributed, whichever works for you. We’d rather you stayed in business than gave us things for free." },
  { tone: "twc-stamp--terracotta", kind: "Support", title: "Underwrite something", text: "Backing a series rather than a single night. This is still being shaped: tell us what you had in mind and we’ll build it around that." },
];

function PartnershipsPage() {
  const copy = Route.useLoaderData();
  const t = (text: string) => copy?.[text] ?? text;
  return (
    <FormCopyProvider copy={copy}>
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <section className="twc-wrap flex flex-wrap items-center gap-14 pb-[88px] pt-[72px]">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5">
            <p className="twc-eyebrow-script">{t("for businesses")}</p>
            <h1 className="twc-display">{t("Partners, not vendors.")}</h1>
            <p className="twc-lede max-w-[560px]">{t("Every gathering happens because someone opens their doors and shares what they know. That’s a collaboration, and we treat it like one.")}</p>
            <p className="twc-chip twc-chip--ring self-start"><Icon name="pin" />Western Queens, New York</p>
          </div>
          <div className="min-w-0 flex-[1_1_380px]">
            <img src={gatheringCeramics} srcSet={gatheringCeramicsSrcSet} sizes={gatheringCeramicsSizes} alt="Two women painting ceramics together at a creative workshop" width={1600} height={1067} fetchPriority="high" className="twc-photo twc-photo--arch aspect-[5/6] w-[min(340px,100%)] object-[30%_center]" />
          </div>
        </section>

        <Scallop from="#fcfcfa" to="#f3f0e8" />
        <section className="twc-band twc-band--cream">
          <div className="twc-wrap flex max-w-[820px] flex-col gap-[18px]">
            <p className="twc-eyebrow">What partnering means</p>
            <h2 className="twc-h3">Neither of us is buying anything.</h2>
            <p className="text-[17px] leading-[1.65] text-sb-muted">We don’t sell access to our members and we don’t book venues. What we do is put a room full of women who run things in front of a business run by someone doing the same, and let that be useful in whichever direction it goes.</p>
            <p className="text-[17px] leading-[1.65] text-sb-muted">In practice that usually means you host something. We bring the people, handle the sign-ups, and credit you properly, on the site and in the room.</p>
            <p className="text-[17px] leading-[1.65] text-sb-muted">What we ask in return is that you show up as yourself rather than as a brand activation. The members can tell the difference within about four minutes, and so can we.</p>
          </div>
        </section>
        <Scallop from="#f3f0e8" to="#fcfcfa" />

        <section aria-labelledby="ways-title" className="twc-wrap flex flex-col gap-9 pb-[104px] pt-[88px]">
          <div className="flex flex-col gap-2">
            <p className="twc-eyebrow-script">ways in</p>
            <h2 id="ways-title" className="twc-h2">Four kinds of collaboration.</h2>
          </div>
          <ul className="twc-stamp-grid m-0 list-none grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))]">
            {WAYS.map((w, i) => (
              <li key={w.kind} className={`twc-stamp ${w.tone}`}>
                <span className="twc-index">0{i + 1} — {w.kind}</span>
                <div className="flex flex-col gap-2.5">
                  <h3 className="text-[32px]">{w.title}</h3>
                  <p>{w.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <Scallop from="#fcfcfa" to="#d8cdf8" />
        <section aria-labelledby="inquiry-title" className="twc-band twc-band--lilac">
          <div className="twc-wrap flex flex-wrap items-start gap-x-16 gap-y-12">
            <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-[18px]">
              <p className="twc-eyebrow-script text-sb-ink">{t("start the conversation")}</p>
              <h2 id="inquiry-title" className="twc-h3">{t("Tell us what you had in mind.")}</h2>
              <p className="max-w-[460px] text-[17px] leading-[1.65]">{t("A couple of sentences is plenty. We answer every one of these, and we’ll say no clearly if it isn’t a fit rather than going quiet on you.")}</p>
              <div className="mt-2 flex flex-col gap-2 rounded-md bg-sb-paper px-6 py-[22px]">
                <h3 className="font-display text-[22px] leading-[1.3]">Before you write</h3>
                <p className="text-[15px] text-sb-muted">
                  If you’re a woman running a business in Western Queens, you may want membership rather than a partnership, or both. They’re separate things and one doesn’t require the other.{" "}
                  <Link to="/join" className="twc-inlink">Apply to join</Link>.
                </p>
              </div>
              <p className="text-[15px]">Rather write in your own words? Use the <Link to="/contact" className="twc-inlink">contact page</Link>.</p>
            </div>
            <div className="flex min-w-0 flex-[1_1_460px] flex-col">
              <PartnershipForm />
            </div>
          </div>
        </section>
        <Scallop from="#d8cdf8" to="#fcfcfa" />
        <div className="pb-24" />
      </main>
      <AppFooter />
    </AppPage>
    </FormCopyProvider>
  );
}
