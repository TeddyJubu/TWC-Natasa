import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Container, Section, SectionHeader } from "@/index";
import { AppNav, AppPage } from "@/app/layout/AppLayout";
import { getSupabase } from "@/app/supabase";
import { useNeighborhoods } from "@/features/neighborhoods/queries";
import { toneFor } from "@/features/neighborhoods/tone";
import { profileQuery, viewerQuery } from "@/features/members/queries";
import { AccountHeader } from "@/features/account/AccountHeader";
import { PublicCardSection } from "@/features/account/PublicCardSection";
import { GatheringsList } from "@/features/account/GatheringsList";
import { HeadshotBooking } from "@/features/account/HeadshotBooking";
import { IntroductionsSection } from "@/features/account/IntroductionsSection";
import { errorMessage } from "@/features/account/helpers";
import { InlineError, Locked } from "@/features/account/shared";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Your Member Profile — The Women’s Collective" },
      { name: "description", content: "Manage your public card, membership, gatherings, headshot session, and introductions." },
      { property: "og:title", content: "Your Member Profile — The Women’s Collective" },
      { property: "og:description", content: "Your corner of the constellation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: hoodList = [] } = useNeighborhoods();
  const profileState = useQuery(profileQuery(user.id));
  // Only decides whether to show the Admin link; /admin's own guard and the database enforce access.
  const admin = useQuery(viewerQuery).data?.admin === true;
  const profile = profileState.data?.profile;
  const avatar = profileState.data?.avatarUrl;
  const approved = profile?.status === "approved";
  const declined = profile?.status === "declined";
  // Her neighborhood, or null when she hasn't chosen one.
  const n = profile?.neighborhood || null;

  const [signOutError, setSignOutError] = React.useState<string | null>(null);

  async function signOut() {
    setSignOutError(null);
    try {
      const { error } = await (await getSupabase()).auth.signOut();
      if (error) throw error;
    } catch (error) {
      setSignOutError(errorMessage(error));
      return;
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    navigate({ to: "/auth", replace: true });
  }

  if (profileState.isPending) {
    return <main id="main" tabIndex={-1} className="grid min-h-screen place-items-center bg-canvas outline-none"><span role="status" aria-label="Loading your profile" className="size-6 animate-spin rounded-full border-2 border-ink border-t-transparent" /></main>;
  }

  // Only when there is nothing to show: a failed background refetch keeps the cached profile (and unsaved edits).
  if (!profile) {
    return (
      <main id="main" tabIndex={-1} className="grid min-h-screen place-items-center bg-canvas p-6 text-ink outline-none">
        <div className="flex max-w-md flex-col items-center gap-5 text-center">
          <p className="font-display text-2xl">{profileState.isError ? "We Couldn’t Load Your Profile" : "Profile Not Found"}</p>
          <p role="alert" className="text-sm text-ink-muted">
            {profileState.isError
              ? errorMessage(profileState.error)
              : "We couldn’t find a member profile for this account. Sign out and try again, or contact us if this keeps happening."}
          </p>
          <div className="flex gap-3">
            {profileState.isError && <Button variant="ink" size="sm" onClick={() => void profileState.refetch()}>Retry</Button>}
            <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
          </div>
          {signOutError && <p role="alert" className="text-sm text-danger">{signOutError}</p>}
        </div>
      </main>
    );
  }

  const tone = toneFor(n, hoodList);

  return (
    <AppPage>
      <AppNav
        links={[
          { label: "Home", href: "/" }, { label: "Members", href: "/members" }, { label: "Profile", href: "/account" },
          ...(admin ? [{ label: "Admin", href: "/admin" }] : []),
        ]}
        action={<Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>}
      />
      <main id="main" tabIndex={-1} className="outline-none">
      {signOutError && <p role="alert" className="bg-surface py-3 text-center text-sm text-danger">{signOutError}</p>}
      {profileState.isError && (
        <Container className="py-3">
          <InlineError message="We couldn’t refresh your profile. What you see may be out of date." onRetry={() => void profileState.refetch()} />
        </Container>
      )}

      {/* Header */}
      <AccountHeader profile={profile} avatar={avatar} approved={approved} declined={declined} neighborhood={n} tone={tone} />

      {!approved && (
        <div className="bg-sun py-3 text-center text-sm text-sun-ink">
          {declined
            ? "Your application wasn’t approved this time. Your card stays private and isn’t shown to anyone."
            : "Your application is being reviewed. Polish your card now — it goes live the day you’re welcomed in."}
        </div>
      )}

      {/* 01 Public card */}
      <PublicCardSection userId={user.id} profile={profile} avatar={avatar} neighborhood={n} hoodList={hoodList} />

      {/* 02 Gatherings & headshot */}
      <Section tone="dome">
        <Container className="flex flex-col gap-16">
          <SectionHeader badgeVariant="solid" badge="02 — Gatherings" title="Where We’ll See You Next" intro="Save your seat at upcoming events and book your included headshot session." />
          {!approved ? <Locked /> : (
            <div className="grid gap-10 lg:grid-cols-[1.3fr_0.9fr]">
              <GatheringsList userId={user.id} hoodList={hoodList} />
              <HeadshotBooking userId={user.id} />
            </div>
          )}
        </Container>
      </Section>

      {/* 03 Introductions */}
      <IntroductionsSection userId={user.id} approved={approved} neighborhood={n} hoodList={hoodList} />
      </main>
    </AppPage>
  );
}
