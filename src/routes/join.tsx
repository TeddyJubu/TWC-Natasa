import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/index";
import { AppFooter, AppNav, AppPage } from "@/app/layout/AppLayout";
import { StatusPage } from "@/app/layout/StatusPages";
import { Icon } from "@/app/layout/twc";
import { ApplicationForm } from "@/features/applications/ApplicationForm";
import { useSubmitApplication } from "@/features/applications/mutations";
import { applicantQuery } from "@/features/applications/queries";
import { CLOSED_TITLE } from "@/features/forms-state/constants";
import { publicFormStateFn } from "@/features/forms-state/fns";
import { paragraphs } from "@/features/forms/schema";

export const Route = createFileRoute("/join")({
  loader: async () => publicFormStateFn({ data: { kind: "application" } }),
  head: () => ({
    meta: [
      { title: "Join The Women’s Collective — Membership application" },
      { name: "description", content: "Apply to The Women’s Collective, a community connecting women across Western Queens." },
      { property: "og:title", content: "Join The Women’s Collective — Membership application" },
      { property: "og:description", content: "Tell us about you, your work, and how you hope to take part in our Western Queens community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinPage,
});

const sections = ["About", "Work", "Community", "WhatsApp", "Spotlight", "Directory", "Headshot", "Events", "Contact", "Guidelines", "Finish"];

function JoinPage() {
  const state = Route.useLoaderData();
  const { mutateAsync: submit } = useSubmitApplication();
  // Prefill is a convenience: while it loads, or if it fails, the form simply starts empty.
  const { data: applicant } = useQuery(applicantQuery);
  if (state.closed) {
    const [first = "", ...rest] = paragraphs(state.closed);
    return (
      <StatusPage script="closed for now" tilt="-rotate-2" title={CLOSED_TITLE.application} intro={first}>
        {rest.map((p, i) => <p key={i} className="max-w-[40ch] text-sb-muted">{p}</p>)}
        <Link to="/" className="twc-btn mt-2">Back to The Women’s Collective <Icon name="arrow" className="twc-arrow" /></Link>
      </StatusPage>
    );
  }
  return (
    <AppPage>
      <AppNav />
      <main id="main" tabIndex={-1} className="twc-wrap flex max-w-[960px] flex-col gap-8 pb-[104px] pt-14 outline-none">
        <div className="twc-ticket bg-[linear-gradient(160deg,#16213f_0%,#0b0b0a_100%)]">
          <div className="twc-ticket__main grow-[4] basis-[480px]">
            <p className="twc-eyebrow-script">psst — there’s a seat for you</p>
            <span className="twc-eyebrow text-sb-paper/70">Membership application</span>
            <h1 className="twc-display text-[clamp(32px,9vw,60px)]">Tell us about your place in the constellation.</h1>
            <p className="max-w-[520px] text-[17px] leading-[1.6] text-sb-paper/85">Complete this application so we can learn about you, your work, and how you would like to participate in The Women’s Collective.</p>
          </div>
          <div className="twc-ticket__stub grow basis-[280px]">
            <div className="twc-ticket__meta"><span>Admit one</span><span>New member</span></div>
            <div className="flex flex-col gap-2.5">
              <span className="twc-ticket__meta">Step 01 of 11</span>
              <ol aria-label="Application sections" className="grid grid-cols-11 gap-1">
                {sections.map((name, i) => (
                  <li key={name} className={cn("h-1.5 rounded-[3px]", i === 0 ? "bg-sb-sun" : "bg-sb-paper/25")}><span className="sr-only">{i + 1}. {name}</span></li>
                ))}
              </ol>
            </div>
            <span aria-hidden className="font-script text-[28px] leading-[1.3] text-sb-sun">← that’s you</span>
          </div>
        </div>
        <ApplicationForm
          submit={submit}
          initial={applicant ?? undefined}
          // A signed-in applicant already has a login, so the next step is only for visitors.
          nextStep={applicant ? undefined : (
            <div className="mt-2 flex flex-col items-center gap-3">
              <p className="max-w-[440px] text-[15px]">While you wait, create your login, so your account is ready the moment you’re approved.</p>
              <Link to="/auth" search={{ mode: "signup" }} className="twc-btn">Create your login <Icon name="arrow" className="twc-arrow" /></Link>
            </div>
          )}
        />
      </main>
      <AppFooter />
    </AppPage>
  );
}
