// The weekly letter, with its own email-only signup (no application needed): one card, its words beside the form.
// `#letter` is where the Guest arch's "Get the newsletter" leads on the same page, so it sits on every page that draws
// the arches (the home page and /membership); "Get launch news" on the bands leads to the home page's. Styles: .twc-letter
// in twc-sections.css.
import { NewsletterSignup } from "@/features/newsletter/NewsletterSignup";

export function Letter() {
  return (
    <section id="letter" aria-labelledby="letter-title" className="twc-letter">
      <div className="twc-card twc-letter__card">
        <div className="twc-letter__words">
          <p className="twc-eyebrow">Every Thursday</p>
          <h2 id="letter-title" className="twc-card__title">The Collective letter</h2>
          <p className="twc-letter__big">Member stories, local finds and opportunities.</p>
          <p>One email a week. Unsubscribe in a click. Guests welcome.</p>
        </div>
        <NewsletterSignup className="twc-letter__form" />
      </div>
    </section>
  );
}
