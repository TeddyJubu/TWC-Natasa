import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button, MemberDialog, type MemberProfile } from "@/index";
import { AppPage } from "@/app/layout/AppLayout";
import { InlineError } from "@/app/layout/app-ui";
import { useSignOut } from "@/app/layout/sign-out";
import { useNeighborhoods, type Neighborhood } from "@/features/neighborhoods/queries";
import { profileQuery, viewerQuery, type Profile } from "@/features/members/queries";
import { useSaveProfile, type ProfilePatch } from "@/features/members/mutations";
import { AccountHeader } from "@/features/account/AccountHeader";
import { AirShell } from "@/features/account/AirShell";
import { MembershipCard, PublicCard, VisibilityCard, WordsCard } from "@/features/account/ProfileCards";
import { GatheringsList } from "@/features/account/GatheringsList";
import { HeadshotBooking } from "@/features/account/HeadshotBooking";
import { IntroductionsSection } from "@/features/account/IntroductionsSection";
import { WhereCard } from "@/features/account/WhereCard";
import { SaveActions } from "@/features/account/SaveActions";
import { PassDialog } from "@/features/account/MemberPass";
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
    return <main id="main" tabIndex={-1} className="app-ground grid min-h-screen place-items-center outline-none"><span role="status" aria-label="Loading your profile" className="size-6 animate-spin rounded-full border-2 border-ink border-t-transparent" /></main>;
  }

  // Only when there is nothing to show: a failed background refetch keeps the cached profile (and unsaved edits).
  if (!profile) {
    return (
      <main id="main" tabIndex={-1} className="app-ground grid min-h-screen place-items-center p-6 text-ink outline-none">
        <div className="flex max-w-md flex-col items-center gap-5 text-center">
          <p className="font-geist text-2xl font-medium">{profileState.isError ? "We Couldn’t Load Your Profile" : "Profile Not Found"}</p>
          <p role="alert" className="text-sm text-ink-muted">
            {profileState.isError
              ? errorMessage(profileState.error)
              : "We couldn’t find a member profile for this account. Sign out and try again, or contact us if this keeps happening."}
          </p>
          <div className="flex gap-3">
            {profileState.isError && <Button variant="ink" size="sm" onClick={() => void profileState.refetch()}>Retry</Button>}
            <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
          </div>
          {signOutError && <p role="alert" className="rounded-2xl bg-app px-4 py-3 text-sm text-danger">{signOutError}</p>}
        </div>
      </main>
    );
  }

  return (
    <AppPage trail={false}>
      <AirShell admin={admin} name={profile.full_name} avatar={avatar} catalogueNumber={profile.status === "approved" ? profile.catalogue_number : null}>
        <ProfileEditorPage
          userId={user.id} profile={profile} avatar={avatar} logoUrl={profileState.data?.logoUrl} hoodList={hoodList}
          applied={profileState.data?.hasApplication === true}
        >
          {profileState.isError && <InlineError message="We couldn’t refresh your profile. What you see may be out of date." onRetry={() => void profileState.refetch()} />}
        </ProfileEditorPage>
      </AirShell>
    </AppPage>
  );
}

/**
 * The page column. Edits collect in one draft over the saved profile; Save sends only the fields that changed
 * (edits go live at once, as before). Portrait, logo and headshot requests save on their own, as they always have.
 */
function ProfileEditorPage({ userId, profile, avatar, logoUrl, hoodList, applied, children }: {
  userId: string; profile: Profile; avatar?: string; logoUrl?: string; hoodList: Neighborhood[]; applied: boolean;
  children: React.ReactNode;
}) {
  const save = useSaveProfile(userId);
  const [draft, setDraft] = React.useState<ProfilePatch>({});
  const [editing, setEditing] = React.useState<Partial<Record<CardKey, boolean>>>({});
  const [focus, setFocus] = React.useState<string | null>(null);
  const [openMember, setOpenMember] = React.useState<MemberProfile | null>(null);
  const [passOpen, setPassOpen] = React.useState(false);
  // "All changes saved" stays up for a moment after a save, then the bar leaves.
  const [saved, setSaved] = React.useState(false);
  const savedFlash = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (savedFlash.current) clearTimeout(savedFlash.current); }, []);
  const card = { ...profile, ...draft };
  const approved = profile.status === "approved";
  const changes = changedFields(profile, draft);
  const dirty = Object.keys(changes).length > 0;

  // Leaving with unsaved edits asks first (the browser's own prompt), as the forms editor does.
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

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
        if (savedFlash.current) clearTimeout(savedFlash.current);
        savedFlash.current = setTimeout(() => setSaved(false), 2500);
      },
    });
  }

  // "View public card" (and the save bar's Preview, which shows unsaved edits too) opens her member pass.
  const preview = () => setPassOpen(true);

  return (
    <main id="main" tabIndex={-1} className="outline-none">
      {children}
      <AccountHeader userId={userId} profile={profile} avatar={avatar} onPreview={preview} />
      <div className="air-grid">
        <WhereCard editor={editor} userId={userId} hood={profile.neighborhood || null} approved={approved} avatar={avatar} hoodList={hoodList} />
        <PublicCard editor={editor} userId={userId} logoPath={profile.business_logo_url} logoUrl={logoUrl} hoodList={hoodList} />
        <WordsCard editor={editor} catalogueNumber={approved ? profile.catalogue_number : null} />
        <MembershipCard profile={profile} />
        <VisibilityCard editor={editor} profile={profile} />
        <HeadshotBooking userId={userId} approved={approved} applied={applied} />
        <GatheringsList userId={userId} approved={approved} applied={applied} hoodList={hoodList} />
        <IntroductionsSection userId={userId} approved={approved} applied={applied} neighborhood={profile.neighborhood || null} onOpen={setOpenMember} />
        <SaveActions
          formId={PROFILE_FORM} dirty={dirty} pending={save.isPending} saved={saved} error={save.isError ? errorMessage(save.error) : null}
          onSubmit={submit} onPreview={preview}
          onDiscard={() => { save.reset(); setDraft({}); setEditing({}); }}
        />
      </div>
      <MemberDialog member={openMember} onClose={() => setOpenMember(null)} />
      <PassDialog open={passOpen} onClose={() => setPassOpen(false)} userId={userId} facts={{ ...card, approved, avatar }} />
    </main>
  );
}
