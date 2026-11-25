import { createFileRoute } from "@tanstack/react-router";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { ContactForm } from "@/features/contact/ContactForm";
import { FormCopyProvider } from "@/features/form-copy/FormCopy";
import { loadFormCopy } from "@/features/form-copy/queries";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — The Women’s Collective" },
      { name: "description", content: "Questions about membership, ideas for an event, partnerships or press: write to The Women’s Collective in North Brooklyn and Queens." },
      { property: "og:title", content: "Say hello — The Women’s Collective" },
      { property: "og:description", content: "A real person reads every message." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: () => loadFormCopy("contact"),
  component: ContactPage,
});

function ContactPage() {
  const copy = Route.useLoaderData();
  const t = (text: string) => copy?.[text] ?? text;
  return (
    <FormCopyProvider copy={copy}>
    <AppPage>
      <AppNav bare />
      <main id="main" tabIndex={-1} className="outline-none">
        <div className="twc-phd">
          <div className="twc-fhead">
            <span className="twc-eyebrow">{t("say hello")}</span>
            <h1 className="twc-display">{t("Say hello, neighbor.")}</h1>
            <p className="twc-lede">
              {t("A question about membership, an idea for an event, a partnership you’d like to explore: send it our way. A real person reads every message.")}
            </p>
          </div>
        </div>
        <div className="twc-fbody">
          <div className="twc-ftwo">
            <ContactForm />
            <aside aria-labelledby="conduct-title" className="twc-fieldc twc-c-blush">
              <h2 id="conduct-title">Something happened that shouldn’t have?</h2>
              <p>
                Reports about a member or an event go straight to the people who handle them, confidentially. Choose “Reporting conduct” as the topic of your message.
              </p>
            </aside>
          </div>
        </div>
      </main>
      <AppFooter bare />
    </AppPage>
    </FormCopyProvider>
  );
}
