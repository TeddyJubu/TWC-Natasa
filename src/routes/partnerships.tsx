import { Link, createFileRoute } from "@tanstack/react-router";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { Icon } from "@/app/layout/twc";
import { PartnershipForm } from "@/features/contact/PartnershipForm";
import { FormCopyProvider } from "@/features/form-copy/FormCopy";
import { loadFormCopy } from "@/features/form-copy/queries";

const TITLE = "Partnerships — The Women’s Collective";
const DESCRIPTION = "Sponsor, collaborate or support: ways to partner with The Women’s Collective that fit your goals and budget.";

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

// The design canvas's partner page (docs/design-canvas/, partner()), its words and packages as drawn. Its "Partnership in
// action" stories are flagged there as examples to replace with real ones, so they are left out until real ones exist.
const WAYS = [
  { title: "Sponsor", field: "twc-c-butter", text: "Put your brand in front of women who run businesses and households in our neighborhoods.",
    items: ["Logo on events, pages and the letter", "Speaking slot and reserved seats", "Packages shaped around your goals"] },
  { title: "Collaborator", field: "twc-c-lilac", text: "Bring a space, product, expertise or audience and co-create an event with us.",
    items: ["Co-host a coffee, panel or workshop", "In-kind: venue, catering, product", "Meet members in person, not through an ad"] },
  { title: "Supporter", field: "twc-c-lime", text: "Fund a seat for a woman who could not otherwise join, or a prize at the Collective Awards.",
    items: ["$200 funds one year of membership", "$395 funds an Incubator seat", "Thanked by name at the event"] },
];
const PACKAGES = [
  ["Event sponsor", "$500–1,500", "One panel or workshop: welcome the room, take a table, attendee opt-in list."],
  ["Newsletter sponsor", "$150–500 an issue", "One slot in the weekly Collective letter."],
  ["Constellation partner", "$3,000 a year", "One neighborhood page, one event a quarter, a member perk."],
  ["Founding partner", "$7,500–10,000 a year", "Homepage slot, Awards night naming, every constellation, Incubator scholarships."],
];
const QUESTIONS = [
  ["What does partnering mean?", "You support the Collective with money, space or expertise, and reach our members in a way that fits your goals."],
  ["Can I support without sponsoring?", "Yes. Fund a membership or Incubator seat as a Supporter."],
  ["Is my support tax-deductible?", "Not at this time. The Collective is a business, not a registered nonprofit."],
];

function PartnershipsPage() {
  const copy = Route.useLoaderData();
  const t = (text: string) => copy?.[text] ?? text;
  // The canvas sets one word of each headline in italic; an admin's own wording shows as written.
  const title = t("Ways to partner");
  const talk = t("Talk to us");
  return (
    <FormCopyProvider copy={copy}>
    <AppPage>
      <AppNav bare />
      <main id="main" tabIndex={-1} className="outline-none">
        <section className="twc-phd">
          <div className="min-w-0">
            <span className="twc-eyebrow">{t("Work with us")}</span>
            <h1 className="twc-display">{title === "Ways to partner" ? <>Ways to <i>partner</i></> : title}</h1>
            <p className="twc-lede">{t("Whether you’re a neighborhood business, a global brand or someone who wants to give back, there is a way to partner that fits your goals and budget.")}</p>
          </div>
        </section>

        <section aria-label="Ways to partner" className="twc-fieldcs">
          {WAYS.map((w) => (
            <div key={w.title} className={`twc-field-c ${w.field}`}>
              <h2>{w.title}</h2>
              <p>{w.text}</p>
              <ul>{w.items.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ))}
        </section>

        <section id="packages" aria-labelledby="packages-title" className="twc-sec">
          <div className="twc-shead"><h2 id="packages-title" className="twc-h2">Sponsor <i>packages</i></h2></div>
          {PACKAGES.map(([name, amount, text]) => (
            <div key={name} className="twc-pkg"><h3>{name}</h3><span className="twc-pkg__amt">{amount}</span><p>{text}</p></div>
          ))}
        </section>

        <section aria-labelledby="questions-title" className="twc-sec">
          <div className="twc-twocol">
            <div>
              <h2 id="questions-title" className="twc-h3">Common <i>questions</i></h2>
              <ul className="twc-qlist">
                {QUESTIONS.map(([q, a]) => <li key={q}><span>Q</span><div><em>{q}</em>{a}</div></li>)}
              </ul>
            </div>
            <div className="twc-partnerform bg-sb-cream">
              <h2 className="twc-h3">{talk === "Talk to us" ? <>Talk to <i>us</i></> : talk}</h2>
              <PartnershipForm />
            </div>
          </div>
        </section>

        <section className="twc-duo" aria-label="Lead or partner">
          <div className="twc-panel twc-c-sky">
            <span className="twc-eyebrow text-sb-ink!">Ambassadors</span>
            <h2>Lead a <i>constellation</i></h2>
            <p className="copy">Every neighborhood is led by two or three women who live there. Uptown and Downtown Manhattan are waiting for theirs.</p>
            <Link to="/contact" className="twc-btn">Apply to be an ambassador <Icon name="arrow" className="twc-arrow" /></Link>
            <div className="twc-panel__info"><p>Uptown<br />Two seats open</p><p>Downtown<br />Two seats open</p><p>Term<br />One year</p></div>
          </div>
          <div className="twc-panel twc-c-blush">
            <span className="twc-eyebrow text-sb-ink!">Partners</span>
            <h2>Partner <i>with</i> us</h2>
            <p className="copy">Bring a space, a product or a budget, and meet the women who run businesses and households in our neighborhoods.</p>
            <a href="#packages" className="twc-btn twc-btn--outline">Ways to partner <Icon name="arrow" className="twc-arrow" /></a>
            <div className="twc-panel__info"><p>Event<br />$500–1,500</p><p>Letter<br />$150–500 an issue</p><p>Founding<br />$7,500–10,000 a year</p></div>
          </div>
        </section>
      </main>
      <AppFooter bare />
    </AppPage>
    </FormCopyProvider>
  );
}
