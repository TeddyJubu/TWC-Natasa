import { Link, createFileRoute } from "@tanstack/react-router";
import gatheringCeramics from "@/assets/photography/site/gathering-ceramics.webp";
import { gatheringCeramicsSizes, gatheringCeramicsSrcSet } from "@/app/responsive-images";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Icon } from "@/app/layout/twc";
import { PartnershipForm } from "@/features/contact/PartnershipForm";
import { FormCopyProvider } from "@/features/form-copy/FormCopy";
import { loadFormCopy } from "@/features/form-copy/queries";

const TITLE = "Partnerships — The Women’s Collective";
const DESCRIPTION = "Host, teach, supply or support: partner with The Women’s Collective in North Brooklyn and Queens. Neither of us is buying anything.";

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
// Each way is a colour field (canvas partner page), ink text on every one.
const WAYS = [
  { field: "twc-c-butter", kind: "Host", title: "Open your space", text: "A studio, a shop floor, a back room, a rooftop. You provide the room; we handle invitations, RSVPs, and everything on the night. Most partnerships start here." },
  { field: "twc-c-lilac", kind: "Teach", title: "Share what you know", text: "A class, a workshop, a demonstration, or forty minutes on the thing you’re genuinely expert in. Not a pitch with a discount code at the end: the actual knowledge." },
  { field: "twc-c-lime", kind: "Supply", title: "Feed the room", text: "Food, coffee, flowers, wine. Paid at cost or contributed, whichever works for you. We’d rather you stayed in business than gave us things for free." },
  { field: "twc-c-sky", kind: "Support", title: "Underwrite something", text: "Backing a series rather than a single night. This is still being shaped: tell us what you had in mind and we’ll build it around that." },
];

function PartnershipsPage() {
  const copy = Route.useLoaderData();
  const t = (text: string) => copy?.[text] ?? text;
  return (
    <FormCopyProvider copy={copy}>
    <AppPage>
      <AppNav bare />
      <main id="main" tabIndex={-1} className="outline-none">
        <div className="twc-phd">
          <div className="twc-fhead">
            <span className="twc-eyebrow">{t("for businesses")}</span>
            <h1 className="twc-display">{t("Partners, not vendors.")}</h1>
            <p className="twc-lede">{t("Every event happens because someone opens their doors and shares what they know. That’s a collaboration, and we treat it like one.")}</p>
            <p className="twc-chip twc-chip--ring self-start"><Icon name="pin" />North Brooklyn and Queens, New York</p>
          </div>
          <img src={gatheringCeramics} srcSet={gatheringCeramicsSrcSet} sizes={gatheringCeramicsSizes} alt="Two women painting ceramics together at a creative workshop" width={1600} height={1067} fetchPriority="high" className="twc-hardphoto aspect-[5/6] w-[min(340px,100%)] object-[30%_center]" />
        </div>

        <section aria-labelledby="means-title" className="twc-sec twc-fsplit">
          <div className="flex flex-col gap-4">
            <span className="twc-eyebrow">What partnering means</span>
            <h2 id="means-title" className="twc-h2">Neither of us is buying anything.</h2>
          </div>
          <div className="flex max-w-[62ch] flex-col gap-4 text-[17px] leading-[1.6]">
            <p>We don’t sell access to our members and we don’t book venues. What we do is put a room full of women who run things in front of a business run by someone doing the same, and let that be useful in whichever direction it goes.</p>
            <p>In practice that usually means you host something. We bring the people, handle the sign-ups, and credit you properly, on the site and in the room.</p>
            <p>What we ask in return is that you show up as yourself rather than as a brand activation. The members can tell the difference within about four minutes, and so can we.</p>
          </div>
        </section>

        <section aria-labelledby="ways-title">
          <div className="twc-sec twc-sec--tight">
            <span className="twc-eyebrow">ways in</span>
            <h2 id="ways-title" className="twc-h2 mt-3">Four kinds of collaboration.</h2>
          </div>
          <ul className="twc-fways">
            {WAYS.map((w, i) => (
              <li key={w.kind} className={`twc-fieldc ${w.field}`}>
                <span className="twc-fmono">{String(i + 1).padStart(2, "0")} — {w.kind}</span>
                <div className="flex flex-col gap-3">
                  <h3>{w.title}</h3>
                  <p>{w.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="inquiry-title" className="twc-sec twc-fsplit">
          <div className="flex min-w-0 flex-col gap-[18px]">
            <span className="twc-eyebrow">{t("start the conversation")}</span>
            <h2 id="inquiry-title" className="twc-h2">{t("Tell us what you had in mind.")}</h2>
            <p className="twc-lede">{t("A couple of sentences is plenty. We answer every one of these, and we’ll say no clearly if it isn’t a fit rather than going quiet on you.")}</p>
            <div className="twc-fieldc twc-c-blush mt-2">
              <h3>Before you write</h3>
              <p>
                If you’re a woman running a business in North Brooklyn or Queens, you may want membership rather than a partnership, or both. They’re separate things and one doesn’t require the other.{" "}
                <Link to="/join" className="twc-inlink">Apply to join</Link>.
              </p>
            </div>
            <p className="text-[15px]">Rather write in your own words? Use the <Link to="/contact" className="twc-inlink">contact page</Link>.</p>
          </div>
          <PartnershipForm />
        </section>
      </main>
      <AppFooter bare />
    </AppPage>
    </FormCopyProvider>
  );
}
