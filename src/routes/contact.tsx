import { Link, createFileRoute } from "@tanstack/react-router";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { ContactForm } from "@/features/contact/ContactForm";
import { FormCopyProvider } from "@/features/form-copy/FormCopy";
import { loadFormCopy } from "@/features/form-copy/queries";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — The Women’s Collective" },
      { name: "description", content: "Questions about membership, ideas for a gathering, partnerships or press: write to The Women’s Collective in Western Queens." },
      { property: "og:title", content: "Say hello — The Women’s Collective" },
      { property: "og:description", content: "A real person in Queens reads every message." },
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
      <AppNav />
      <main id="main" tabIndex={-1} className="twc-wrap flex flex-wrap items-start gap-x-16 gap-y-14 pt-12 pb-20 outline-none md:pt-[72px] md:pb-[104px]">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-[22px]">
          <p className="twc-eyebrow-script">{t("say hello")}</p>
          <h1 className="twc-h2">{t("Say hello, neighbor.")}</h1>
          <p className="max-w-[480px] text-[17px] leading-[1.65] text-sb-muted">
            {t("A question about membership, an idea for a gathering, a partnership you’d like to explore: send it our way. A real person in Queens reads every message.")}
          </p>
          <div className="mt-2 flex flex-col gap-2 rounded-md bg-sb-cream px-6 py-[22px]">
            <h2 className="font-display text-[22px] leading-[1.3]">Something happened that shouldn’t have?</h2>
            <p className="text-[15px] text-sb-muted">
              Reports about a member or an event go straight to the people who handle them, confidentially. Choose “Reporting conduct” as the topic of your message.
            </p>
          </div>
          <p className="text-[15px] text-sb-muted">
            Looking for quick answers? Try the <Link to="/faq" className="twc-inlink">questions page</Link>.
          </p>
        </div>
        <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-8">
          <ContactForm />
        </div>
      </main>
      <AppFooter />
    </AppPage>
    </FormCopyProvider>
  );
}
