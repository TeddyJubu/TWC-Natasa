import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { StatusPage } from "@/app/layout/StatusPages";
import { openFormFn } from "@/features/forms/fns";
import { paragraphs } from "@/features/forms/schema";

/** /f/<slug>/thanks: the form's own thank-you words (OPS-191), kept at the old address so links people hold still work. */
export const Route = createFileRoute("/f/$slug_/thanks")({
  loader: async ({ params }) => {
    const form = await openFormFn({ data: { slug: params.slug } });
    if (!form) throw notFound();
    if (form.moved) throw redirect({ to: "/f/$slug/thanks", params: { slug: form.slug }, statusCode: 301 });
    return { name: form.name, thanks: form.thanks };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `Thank you — ${loaderData?.name ?? "Form"} — The Women’s Collective` }, { name: "robots", content: "noindex" }],
  }),
  component: ThanksPage,
});

function ThanksPage() {
  const { name, thanks } = Route.useLoaderData();
  const [first = "", ...rest] = paragraphs(thanks);
  return (
    <StatusPage script="thank you" tilt="-rotate-2" title={name} intro={first}>
      {rest.map((p, i) => <p key={i} className="max-w-[40ch] text-sb-muted">{p}</p>)}
      <Link to="/" className="twc-btn mt-2">Back to the site</Link>
    </StatusPage>
  );
}
