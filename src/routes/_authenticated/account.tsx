import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button, MemberDialog, type MemberProfile } from "@/index";
import { AppPage } from "@/app/layout/AppLayout";
import { AppShell, TopBar } from "@/app/layout/AppShell";
import { InlineError } from "@/app/layout/app-ui";
import { useSignOut } from "@/app/layout/sign-out";
import { useNeighborhoods, type Neighborhood } from "@/features/neighborhoods/queries";
import { profileQuery, viewerQuery, type Profile } from "@/features/members/queries";
import { toMemberProfile } from "@/features/members/map";
import { useSaveProfile, type ProfilePatch } from "@/features/members/mutations";
import { AccountHeader } from "@/features/account/AccountHeader";
import { MembershipCard, PublicCard, VisibilityCard, WordsCard } from "@/features/account/ProfileCards";
import { GatheringsList } from "@/features/account/GatheringsList";
import { HeadshotBooking } from "@/features/account/HeadshotBooking";
import { IntroductionsSection } from "@/features/account/IntroductionsSection";
import { SaveActions } from "@/features/account/SaveActions";
import { PROFILE_FORM, changedFields, errorMessage, fieldId, type CardKey, type ProfileEditor } from "@/features/account/helpers";

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
  const { data: hoodList = [] } = useNeighborhoods();
  const profileState = useQuery(profileQuery(user.id));
  // Only decides whether to show the Admin link; /admin's own guard and the database enforce access.
  const admin = useQuery(viewerQuery).data?.admin === true;
  const profile = profileState.data?.profile;
  const avatar = profileState.data?.avatarUrl;

  // The not-found screen's own Sign out; the shell has its own.
  const { signOut, error: signOutError } = useSignOut();

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

  return (
    <AppPage>
      <AppShell page="/account" admin={admin}>
        <ProfileEditorPage userId={user.id} profile={profile} avatar={avatar} logoUrl={profileState.data?.logoUrl} hoodList={hoodList}>
          {profileState.isError && <InlineError message="We couldn’t refresh your profile. What you see may be out of date." onRetry={() => void profileState.refetch()} />}
        </ProfileEditorPage>
      </AppShell>
    </AppPage>
  );
}

/**
 * The page column. Edits collect in one draft over the saved profile; Save sends only the fields that changed
 * (edits go live at once, as before). Portrait, logo and headshot requests save on their own, as they always have.
 */
function ProfileEditorPage({ userId, profile, avatar, logoUrl, hoodList, children }: {
  userId: string; profile: Profile; avatar?: string; logoUrl?: string; hoodList: Neighborhood[];
  children: React.ReactNode;
}) {
  const save = useSaveProfile(userId);
  const [draft, setDraft] = React.useState<ProfilePatch>({});
  const [editing, setEditing] = React.useState<Partial<Record<CardKey, boolean>>>({});
  const [focus, setFocus] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [openMember, setOpenMember] = React.useState<MemberProfile | null>(null);
  const card = { ...profile, ...draft };
  const changes = changedFields(profile, draft);
  const dirty = Object.keys(changes).length > 0;

  // "Add" opens a card and focuses its field once it has rendered.
  React.useLayoutEffect(() => {
    if (focus) document.getElementById(focus)?.focus();
    setFocus(null);
  }, [focus]);

  const editor: ProfileEditor = {
    card,
    set: (patch) => { setSaved(false); setDraft((d) => ({ ...d, ...patch })); },
    isEditing: (key) => !!editing[key],
    toggle: (key) => setEditing((e) => ({ ...e, [key]: !e[key] })),
    add: (key, field) => { setEditing((e) => ({ ...e, [key]: true })); setFocus(fieldId(field)); },
  };

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty) return;
    save.mutate(changes, {
      onSuccess: (next) => {
        // Keep only what still differs from the saved row (typing during the save survives), and show values again.
        setDraft((d) => changedFields(next, d));
        setEditing({});
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      },
    });
  }

  return (
    <main id="main" tabIndex={-1} className="outline-none">
      <TopBar section="My Account" icon="circle-user-round" title="Profile">
        <SaveActions
          formId={PROFILE_FORM} dirty={dirty} pending={save.isPending} saved={saved} error={save.isError ? errorMessage(save.error) : null}
          onSubmit={submit}
          onPreview={() => setOpenMember(toMemberProfile(card, { image: avatar, logo: logoUrl, placeholders: true }))}
        />
      </TopBar>
      {children}
      <div className="max-w-277">
        <AccountHeader userId={userId} profile={profile} avatar={avatar} />
        <div className="flex flex-col gap-6 px-4 pt-2 pb-14 sm:px-8 lg:px-12">
          <PublicCard editor={editor} userId={userId} logoPath={profile.business_logo_url} logoUrl={logoUrl} hoodList={hoodList} />
          <WordsCard editor={editor} />
          <MembershipCard profile={profile} />
          <VisibilityCard editor={editor} />
          <HeadshotBooking userId={userId} approved={profile.status === "approved"} />
          <GatheringsList userId={userId} approved={profile.status === "approved"} hoodList={hoodList} />
          <IntroductionsSection userId={userId} approved={profile.status === "approved"} neighborhood={profile.neighborhood || null} hoodList={hoodList} onOpen={setOpenMember} />
        </div>
      </div>
      <MemberDialog member={openMember} onClose={() => setOpenMember(null)} />
    </main>
  );
}
