import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppPage } from "@/app/layout/AppLayout";
import { AppShell, TopBar } from "@/app/layout/AppShell";
import { BackToForms, BuiltInFormPanel, CustomFormPanel } from "@/features/admin/panels";
import { FORM_TABS, type FormTab } from "@/features/admin/format";
import { adminFormResponsesQuery } from "@/features/forms/queries";
import { BUILT_IN_INFO, isBuiltIn } from "@/features/form-copy/manifest";

export const Route = createFileRoute("/_authenticated/_admin/admin_/forms/$formId")({
  head: () => ({
    meta: [
      { title: "Edit form — The Women’s Collective" },
      { name: "robots", content: "noindex" },
    ],
  }),
  // ?tab= picks a custom form's tab (Answers by default); anything else is dropped.
  validateSearch: (search: Record<string, unknown>): { tab?: FormTab } =>
    (FORM_TABS.includes(search.tab as FormTab) ? { tab: search.tab as FormTab } : {}),
  component: FormPage,
});

/**
 * One form's edit page. A built-in form (`application`, `review`, `contact`, `partnership`, `newsletter`) edits its
 * wording and open/close; anything else is the id of one of your own /f/… forms. Admin-only, like all of /admin.
 */
function FormPage() {
  const { user } = Route.useRouteContext();
  const { formId } = Route.useParams();
  const { tab = "answers" } = Route.useSearch();
  const navigate = useNavigate();
  // The tab is in the URL (shareable, survives a reload) without a history entry per click.
  const onTab = (next: FormTab) => void navigate({ to: "/admin/forms/$formId", params: { formId }, search: next === "answers" ? {} : { tab: next }, replace: true });
  const builtIn = isBuiltIn(formId) ? formId : null;
  const forms = useQuery({ ...adminFormResponsesQuery, enabled: !builtIn });
  const title = builtIn ? BUILT_IN_INFO[builtIn].title : forms.data?.find((f) => f.id === formId)?.name ?? "Form";
  return (
    <AppPage trail={false}>
      <AppShell page="/admin/forms/edit" admin>
        <main id="main" tabIndex={-1} className="outline-none">
          <TopBar title={title} heading who={{ name: user.name || user.email }} />
          <div className="flex max-w-250 flex-col gap-6 px-4 pt-5 pb-14 sm:px-8 sm:pt-8">
            <BackToForms />
            {builtIn ? <BuiltInFormPanel kind={builtIn} /> : <CustomFormPanel id={formId} tab={tab} onTab={onTab} />}
          </div>
        </main>
      </AppShell>
    </AppPage>
  );
}
