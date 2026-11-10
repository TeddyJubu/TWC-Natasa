import { createFileRoute, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { StatusPage } from "@/app/layout/StatusPages";
import { CustomForm } from "@/features/forms/CustomForm";
import { openFormFn } from "@/features/forms/fns";
import { paragraphs } from "@/features/forms/schema";

/**
 * /f/<slug>: a form made in the CRM (OPS-518: the apex's /f/* links land here). An old name 301s to the current one
 * (OPS-425), a closed form shows its closed words (OPS-241), and an unknown name is the site's 404.
 */
export const Route = createFileRoute("/f/$slug")({
  loader: async ({ params }) => {
    const form = await openFormFn({ data: { slug: params.slug } });
    if (!form) throw notFound();
    if (form.moved) throw redirect({ to: "/f/$slug", params: { slug: form.slug }, statusCode: 301 });
    return form;
  },
  head: ({ loaderData }) => ({
    // ponytail: every form is noindex until the CRM's "listed" switch (and the /forms list, OPS-426) is rebuilt.
    meta: [{ title: `${loaderData?.name ?? "Form"} — The Women’s Collective` }, { name: "robots", content: "noindex" }],
    // Public capture key for the doop canvas. script-src and connect-src allow this origin.
    scripts: [{ async: true, src: "https://doop.design/doop-sync.js?key=dk_43wWjXdIlAXKScXwf9wqhCzb" }],
  }),
  component: FormPage,
});

function FormPage() {
  const form = Route.useLoaderData();
  const navigate = useNavigate();
  if (form.closed) {
    const [first = "", ...rest] = paragraphs(form.closed);
    return (
      <StatusPage script="closed for now" tilt="-rotate-2" title={form.name} intro={first}>
        {rest.map((p, i) => <p key={i} className="max-w-[40ch] text-sb-muted">{p}</p>)}
      </StatusPage>
    );
  }
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="twc-wrap flex max-w-[960px] flex-col gap-8 pb-[104px] pt-14 outline-none">
        <div className="flex flex-col gap-4">
          <span className="twc-eyebrow">The Women’s Collective</span>
          <h1 className="twc-h2">{form.name}</h1>
          {paragraphs(form.intro).map((p, i) => <p key={i} className="max-w-[640px] text-[17px] leading-[1.65] text-sb-muted">{p}</p>)}
        </div>
        <CustomForm form={form} onSent={() => void navigate({ to: "/f/$slug/thanks", params: { slug: form.slug } })} />
      </main>
      <AppFooter />
    </AppPage>
  );
}
