import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { StatusPage } from "@/app/layout/StatusPages";
import { ApplicationForm } from "@/features/applications/ApplicationForm";
import { AreaChoice, AreaSwitch } from "@/features/applications/AreaChoice";
import { useSubmitApplication } from "@/features/applications/mutations";
import { AREAS, areaById } from "@/features/applications/schema";
import { applicantQuery } from "@/features/applications/queries";
import { CLOSED_TITLE } from "@/features/forms-state/constants";
import { publicFormStateFn } from "@/features/forms-state/fns";
import { FormCopyProvider } from "@/features/form-copy/FormCopy";
import { loadFormCopy } from "@/features/form-copy/queries";
import { paragraphs } from "@/features/forms/schema";

export const Route = createFileRoute("/join")({
  // ?area= skips the area question; an unknown one is dropped, and no area asks it. Not a loader dep: changing area
  // mustn't reload the page, so the form keeps what she has typed.
  validateSearch: (raw: Record<string, unknown>): { area?: string } =>
    (AREAS.some((a) => a.id === raw.area) ? { area: raw.area as string } : {}),
  loader: async () => {
    const [state, copy] = await Promise.all([publicFormStateFn({ data: { kind: "application" } }), loadFormCopy("application")]);
    return { ...state, copy };
  },
  head: ({ match }) => {
    const where = areaById(match.search.area)?.name ?? "North Brooklyn and Queens";
    return { meta: [
      { title: "Join The Women’s Collective — Membership application" },
      { name: "description", content: `Apply to The Women’s Collective, a community connecting women across ${where}.` },
      { property: "og:title", content: "Join The Women’s Collective — Membership application" },
      { property: "og:description", content: `Tell us about you, your work, and how you hope to take part in our ${where} community.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ] };
  },
  component: JoinPage,
});

function JoinPage() {
  const state = Route.useLoaderData();
  const t = (text: string) => state.copy?.[text] ?? text;
  const area = areaById(Route.useSearch().area);
  const { mutateAsync: submit } = useSubmitApplication();
  const navigate = useNavigate();
  // Prefill is a convenience: while it loads, or if it fails, the form simply starts empty.
  const { data: applicant } = useQuery(applicantQuery);
  if (state.closed) {
    const [first = "", ...rest] = paragraphs(state.closed);
    return (
      <StatusPage bare script="closed for now" tilt="-rotate-2" title={CLOSED_TITLE.application} intro={first}>
        {rest.map((p, i) => <p key={i} className="max-w-[40ch] text-sb-muted">{p}</p>)}
      </StatusPage>
    );
  }
  return (
    <AppPage>
      <AppNav bare />
      <FormCopyProvider copy={state.copy}>
      <main id="main" tabIndex={-1} className="outline-none">
        <div className="twc-phd">
          <div className="twc-fhead">
            <span className="twc-eyebrow">{t("Membership application")}</span>
            <h1 className="twc-display">{t("Tell us about your place in the constellation.")}</h1>
            <p className="twc-lede">{t("Complete this application so we can learn about you, your work, and how you would like to participate in The Women’s Collective.")}</p>
            <p className="twc-fmono">{t("Seven short sections. Your answers save on this device as you go.")}</p>
          </div>
          <p className="twc-fmono twc-fhead__side">{t("psst — there’s a seat for you")}</p>
        </div>
        <div className="twc-fbody">
          {area ? (
            <>
              <AreaSwitch area={area} />
              <ApplicationForm
                area={area}
                submit={submit}
                initial={applicant ?? undefined}
                // ponytail: pre-launch an applicant only needs to apply, so no login step; the thank-you is its own page.
                // Her email rides in the history entry's state (handoff.ts), never the URL, for the thanks page's login button.
                onSent={(email) => void navigate({ to: "/join/thanks", ...(email ? { state: { applicantEmail: email } } : {}) })}
              />
            </>
          ) : <AreaChoice />}
        </div>
      </main>
      </FormCopyProvider>
      <AppFooter bare />
    </AppPage>
  );
}
