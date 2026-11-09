import { createFileRoute } from "@tanstack/react-router";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";

// Placeholder: built out from the design canvas board. noindex until then.
export const Route = createFileRoute("/gatherings")({
  head: () => ({ meta: [{ title: "Gatherings — The Women’s Collective" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="twc-wrap py-24 outline-none">
        <h1 className="twc-h2">Gatherings</h1>
      </main>
      <AppFooter />
    </AppPage>
  );
}
