import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppPage } from "@/app/layout/AppLayout";
import { AppShell, TopBar } from "@/app/layout/AppShell";
import { BackToForms, BuiltInFormPanel, CustomFormPanel } from "@/features/admin/panels";
import { adminFormResponsesQuery } from "@/features/forms/queries";
import { BUILT_IN_INFO, isBuiltIn } from "@/features/form-copy/manifest";

export const Route = createFileRoute("/_authenticated/_admin/admin_/forms/$formId")({
  head: () => ({
    meta: [
      { title: "Edit form — The Women’s Collective" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FormPage,
});

/**
 * One form's edit page. A built-in form (`application`, `review`, `contact`, `partnership`, `newsletter`) edits its
 * wording and open/close; anything else is the id of one of your own /f/… forms. Admin-only, like all of /admin.
 */
function FormPage() {
  const { user } = Route.useRouteContext();
  const { formId } = Route.useParams();
  const builtIn = isBuiltIn(formId) ? formId : null;
  const forms = useQuery({ ...adminFormResponsesQuery, enabled: !builtIn });
  const title = builtIn ? BUILT_IN_INFO[builtIn].title : forms.data?.find((f) => f.id === formId)?.name ?? "Form";
  return (
    <AppPage>
      <AppShell page="/admin/forms/edit" admin>
        <main id="main" tabIndex={-1} className="outline-none">
          <TopBar title={title} heading who={{ name: user.name || user.email }} />
          <div className="flex max-w-250 flex-col gap-6 px-4 pt-5 pb-14 sm:px-8 sm:pt-8">
            <BackToForms />
            {builtIn ? <BuiltInFormPanel kind={builtIn} /> : <CustomFormPanel id={formId} />}
          </div>
        </main>
      </AppShell>
    </AppPage>
  );
}
