import * as React from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge, BrandLockup, Button, Container, FileUpload, FormActions, FormField, FormNotice, FormSection, Heading,
  Input, MemberCard, Navbar, Section, SectionHeader, Select, Switch, Text, Textarea, cn,
} from "@/index";
import { getSupabase } from "@/app/supabase";
import { useNeighborhoods } from "@/features/neighborhoods/queries";
import { toneFor } from "@/features/neighborhoods/tone";
import { initials, toMemberProfile } from "@/features/members/map";
import { introsQuery, profileQuery, type Profile } from "@/features/members/queries";
import { useSaveProfile, useUploadAvatar, type ProfilePatch } from "@/features/members/mutations";
import { bookingQuery, eventsQuery, rsvpsQuery } from "@/features/events/queries";
import { useBookHeadshot, useToggleRsvp } from "@/features/events/mutations";

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

/** Inline `--hood` for a neighborhood color, consumed via `bg-(--hood)` / `text-(--hood)`. */
const hoodStyle = (color?: string) => (color ? ({ "--hood": color } as React.CSSProperties) : undefined);

/** The card fields as currently typed in the form (also the save patch). Unlisted means not public. */
function readCard(form: HTMLFormElement, profile: Profile): ProfilePatch {
  const f = new FormData(form);
  const text = (name: string) => String(f.get(name) ?? "").trim();
  const directory_visible = f.get("directory_visible") === "on";
  return {
    full_name: text("full_name"), role_title: text("role_title"), business: text("business"),
    neighborhood: String(f.get("neighborhood") ?? profile.neighborhood), specialty: text("specialty"),
    website: text("website"), bio: text("bio").slice(0, 400), looking_for: text("looking_for").slice(0, 160),
    directory_visible, public_profile: directory_visible && f.get("public_profile") === "on",
  };
}

const errorMessage = (error: unknown) =>
  (error as { message?: string } | null)?.message || "Something went wrong. Please try again.";

function AccountPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: hoodList = [] } = useNeighborhoods();
  const profileState = useQuery(profileQuery(user.id));
  const profile = profileState.data?.profile;
  const avatar = profileState.data?.avatarUrl;
  const approved = profile?.status === "approved";
  const declined = profile?.status === "declined";
  const n = profile?.neighborhood ?? "";

  const eventsState = useQuery({ ...eventsQuery, enabled: approved });
  const rsvpsState = useQuery({ ...rsvpsQuery(user.id), enabled: approved });
  const bookingState = useQuery({ ...bookingQuery(user.id), enabled: approved });
  const introsState = useQuery({ ...introsQuery(user.id, n), enabled: approved, placeholderData: keepPreviousData });

  const save = useSaveProfile(user.id);
  const upload = useUploadAvatar(user.id);
  const toggle = useToggleRsvp(user.id);
  const book = useBookHeadshot(user.id);
  const [saved, setSaved] = React.useState(false);
  const [changingBooking, setChangingBooking] = React.useState(false);
  const [signOutError, setSignOutError] = React.useState<string | null>(null);
  // Unsaved form edits; drives the preview and the public switch until the next save.
  const [draft, setDraft] = React.useState<ProfilePatch | null>(null);

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

  function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    const patch = readCard(e.currentTarget, profile);
    setSaved(false);
    save.mutate(patch, {
      // The draft stays: once the saved row matches it, it no longer counts as unsaved (and later typing survives).
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      },
    });
  }

  function bookHeadshot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    book.mutate(
      { preferred_date: String(f.get("date")), preferred_time: String(f.get("time")), notes: String(f.get("notes") ?? "") },
      { onSuccess: () => setChangingBooking(false) },
    );
  }

  if (profileState.isPending) {
    return <div className="grid min-h-screen place-items-center bg-canvas"><span role="status" aria-label="Loading your profile" className="size-6 animate-spin rounded-full border-2 border-ink border-t-transparent" /></div>;
  }

  // Only when there is nothing to show: a failed background refetch keeps the cached profile (and unsaved edits).
  if (!profile) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas p-6 text-ink">
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
      </div>
    );
  }

  const tone = toneFor(n, hoodList);
  const hoodNames = hoodList.map((hood) => hood.name);
  const neighborhoodOptions = n && !hoodNames.includes(n) ? [...hoodNames, n] : hoodNames;
  const events = eventsState.data ?? [];
  const rsvps = new Set(rsvpsState.data ?? []);
  const booking = changingBooking ? null : bookingState.data ?? null;
  const intros = introsState.data ?? [];
  const card = { ...profile, ...draft };
  const unsaved = !!draft && Object.entries(draft).some(([key, value]) => profile[key as keyof Profile] !== value);
  const listed = card.directory_visible ?? profile.directory_visible;
  const since = profile.member_since ? new Date(profile.member_since).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—";

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Navbar
        brand={<Link to="/" aria-label="Home"><BrandLockup compact /></Link>}
        links={[{ label: "Home", href: "/" }, { label: "Members", href: "/members" }, { label: "Profile", href: "/account" }]}
        action={<Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>}
      />
      {signOutError && <p role="alert" className="bg-surface py-3 text-center text-sm text-danger">{signOutError}</p>}
      {profileState.isError && (
        <Container className="py-3">
          <InlineError message="We couldn’t refresh your profile. What you see may be out of date." onRetry={() => void profileState.refetch()} />
        </Container>
      )}

      {/* Header */}
      <Section tone="night" className="overflow-hidden pt-16 md:pt-24">
        <Container className="grid items-end gap-12 md:grid-cols-[0.8fr_1.2fr] md:gap-20">
          <div className={cn("motion-reveal relative aspect-[4/5] w-full max-w-sm rounded-card p-4", tone ? "bg-(--hood)" : "bg-surface")} style={hoodStyle(tone?.color)}>
            {avatar
              ? <img src={avatar} alt={`Portrait of ${profile.full_name}`} className="size-full rounded-control object-cover" />
              : <div className="grid size-full place-items-center rounded-control bg-canvas font-display text-8xl text-ink">{initials(profile.full_name)}</div>}
            <span className="absolute -right-3 -top-3 rounded-full bg-sun px-4 py-2 text-xs text-sun-ink">{approved ? `No. ${String(profile.catalogue_number ?? 0).padStart(2, "0")}` : declined ? "Not approved" : "In review"}</span>
          </div>
          <div className="motion-stagger flex flex-col gap-7">
            <Badge variant="solid">{approved ? "Approved member" : declined ? "Application not approved" : "Application pending"}</Badge>
            <Heading as="h1" size="display" className="break-words">{profile.full_name || "Welcome, Neighbor"}</Heading>
            <Text size="lg" tone="muted">{[profile.role_title, profile.business].filter(Boolean).join(" · ") || "Add your role and business below so neighbors know what you do."}</Text>
            <dl className="grid grid-cols-3 gap-6 border-t border-line pt-6">
              <div><dt className="text-xs uppercase text-ink-muted">Catalogue</dt><dd className="mt-2 font-display text-4xl">{approved ? String(profile.catalogue_number ?? 0).padStart(2, "0") : "—"}</dd></div>
              <div><dt className="text-xs uppercase text-ink-muted">Member since</dt><dd className="mt-2 font-display text-2xl md:text-3xl">{since}</dd></div>
              <div><dt className="text-xs uppercase text-ink-muted">Neighborhood</dt><dd className={cn("mt-2 font-display text-2xl md:text-3xl", tone && "text-(--hood)")} style={hoodStyle(tone?.color)}>{n}</dd></div>
            </dl>
          </div>
        </Container>
      </Section>

      {!approved && (
        <div className="bg-sun py-3 text-center text-sm text-sun-ink">
          {declined
            ? "Your application wasn’t approved this time. Your card stays private and isn’t shown to anyone."
            : "Your application is being reviewed. Polish your card now — it goes live the day you’re welcomed in."}
        </div>
      )}

      {/* 01 Public card */}
      <Section>
        <Container className="flex flex-col gap-16">
          <SectionHeader badge="01 — Your public card" title="How Neighbors Will Meet You" intro="This is what appears in the member directory when you choose to be visible." />
          <div className="grid gap-14 lg:grid-cols-[1.4fr_0.8fr]">
            <form onSubmit={saveProfile} onChange={(e) => setDraft(readCard(e.currentTarget, profile))} className="flex flex-col gap-14">
              <FormSection index="A" title="The Basics" description="Your name and the work you’re known for.">
                <div className="grid gap-8 md:grid-cols-2">
                  <FormField label="Full name" htmlFor="full_name" index="01"><Input id="full_name" name="full_name" defaultValue={profile.full_name} required maxLength={80} /></FormField>
                  <FormField label="Role" htmlFor="role_title" index="02"><Input id="role_title" name="role_title" defaultValue={profile.role_title} maxLength={80} placeholder="Founder & Designer" /></FormField>
                  <FormField label="Business" htmlFor="business" index="03"><Input id="business" name="business" defaultValue={profile.business} maxLength={80} /></FormField>
                  <FormField label="Specialty" htmlFor="specialty" index="04"><Input id="specialty" name="specialty" defaultValue={profile.specialty} maxLength={60} placeholder="Food & hospitality" /></FormField>
                  <FormField label="Neighborhood" htmlFor="neighborhood" index="05">
                    <Select id="neighborhood" name="neighborhood" defaultValue={profile.neighborhood}>{neighborhoodOptions.map((x) => <option key={x}>{x}</option>)}</Select>
                  </FormField>
                  <FormField label="Website" htmlFor="website" index="06" optional><Input id="website" name="website" type="url" defaultValue={profile.website} maxLength={200} placeholder="https://" /></FormField>
                </div>
              </FormSection>
              <FormSection index="B" title="In Your Words" description="Short and warm beats long and formal.">
                <div className="flex flex-col gap-8">
                  <FormField label="Bio" htmlFor="bio" index="07" hint="Up to 400 characters."><Textarea id="bio" name="bio" defaultValue={profile.bio} maxLength={400} aria-describedby="bio-hint" /></FormField>
                  <FormField label="Looking to meet" htmlFor="looking_for" index="08"><Input id="looking_for" name="looking_for" defaultValue={profile.looking_for} maxLength={160} placeholder="Retail partners and fellow makers" /></FormField>
                </div>
              </FormSection>
              <FormSection index="C" title="Portrait & Visibility">
                <div className="grid gap-8 md:grid-cols-2">
                  <div className="flex flex-col gap-3">
                    <FileUpload label="Upload a portrait" hint="JPG, PNG or WebP, up to 5 MB" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (file) upload.mutate(file); }} />
                    {upload.isError && <p role="alert" className="text-sm text-danger">{errorMessage(upload.error)}</p>}
                  </div>
                  <div className="flex flex-col">
                    <Switch name="directory_visible" defaultChecked={profile.directory_visible} label="Show me in the member directory" description="Only appears once your membership is approved." />
                    {/* Controlled from the draft: switching the directory off also switches this off, so re-listing never republishes silently. */}
                    <Switch
                      name="public_profile"
                      checked={listed && (card.public_profile ?? false)}
                      onChange={() => undefined}
                      disabled={!listed}
                      className="border-t-0"
                      label="Show my profile on the public website"
                      description="Anyone on the internet can then see your card — name, portrait, work, neighborhood, bio and links — on our homepage and public member page. Needs “Show me in the member directory” on, and goes live only once you’re approved."
                    />
                  </div>
                </div>
              </FormSection>
              {save.isError && <p role="alert" className="text-sm text-danger">{errorMessage(save.error)}</p>}
              <FormActions><Button type="submit" variant="ink" state={save.isPending ? "loading" : saved ? "success" : "idle"}>Save my card</Button></FormActions>
            </form>
            <aside aria-label="Card preview" className="lg:sticky lg:top-32 lg:self-start">
              <p className="mb-4 text-xs uppercase text-ink-muted">{unsaved ? "Preview · unsaved changes" : "Preview of your saved card"}</p>
              <div className="rounded-panel bg-black p-4">
                <MemberCard member={toMemberProfile({ ...profile, ...card }, { image: avatar, placeholders: true })} variant="catalogue" tone={toneFor(card.neighborhood ?? n, hoodList)} catalogueNumber={profile.catalogue_number ?? 0} />
              </div>
            </aside>
          </div>
        </Container>
      </Section>

      {/* 02 Gatherings & headshot */}
      <Section tone="dome">
        <Container className="flex flex-col gap-16">
          <SectionHeader badgeVariant="solid" badge="02 — Gatherings" title="Where We’ll See You Next" intro="Save your seat at upcoming events and book your included headshot session." />
          {!approved ? <Locked /> : (
            <div className="grid gap-10 lg:grid-cols-[1.3fr_0.9fr]">
              <div className="flex flex-col gap-6">
              {(eventsState.isError || rsvpsState.isError) && (
                <InlineError
                  message="We couldn’t load upcoming gatherings."
                  onRetry={() => { if (eventsState.isError) void eventsState.refetch(); if (rsvpsState.isError) void rsvpsState.refetch(); }}
                />
              )}
              {toggle.isError && <p role="alert" className="text-sm text-danger">{errorMessage(toggle.error)}</p>}
              <ol className="flex flex-col border-t border-line">
                {events.map((ev) => {
                  const d = new Date(ev.starts_at);
                  const going = rsvps.has(ev.id);
                  const eventColor = toneFor(ev.neighborhood, hoodList)?.color;
                  return (
                    <li key={ev.id} className="motion-scroll-reveal grid grid-cols-[4.5rem_1fr] gap-6 border-b border-line py-7 sm:grid-cols-[4.5rem_1fr_auto] sm:items-center">
                      <div className="text-center"><p className={cn("text-xs uppercase", eventColor && "text-(--hood)")} style={hoodStyle(eventColor)}>{d.toLocaleDateString("en-US", { month: "short" })}</p><p className="font-display text-5xl leading-none">{d.getDate()}</p></div>
                      <div className="min-w-0">
                        <h3 className="font-display text-2xl">{ev.title}</h3>
                        <p className="mt-1 text-sm text-ink-muted">{ev.location} · {ev.neighborhood} · {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                        <p className="mt-2 text-sm text-ink-muted">{ev.description}</p>
                      </div>
                      <Button size="sm" variant={going ? "white" : "outline"} aria-pressed={going} disabled={toggle.isPending || !rsvpsState.isSuccess} onClick={() => toggle.mutate({ eventId: ev.id, going: !going })} className="col-start-2 justify-self-start sm:col-start-3">{going ? "✓ You’re going" : "Save my seat"}</Button>
                    </li>
                  );
                })}
              </ol>
              </div>
              <div className="rounded-panel border border-line p-7">
                <Badge variant="solid">Headshot session</Badge>
                <h3 className="mt-5 font-display text-3xl">Your Portrait, Professionally Done</h3>
                {bookingState.isError ? (
                  <div className="mt-6"><InlineError message="We couldn’t load your headshot request." onRetry={() => void bookingState.refetch()} /></div>
                ) : booking ? (
                  <FormNotice className="mt-6" title="Request received" tone="accent">
                    {new Date(booking.preferred_date + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {booking.preferred_time}. We’ll confirm by email.
                    <button type="button" className="mt-3 block underline underline-offset-4" onClick={() => { book.reset(); setChangingBooking(true); }}>Change request</button>
                  </FormNotice>
                ) : (
                  <form onSubmit={bookHeadshot} className="mt-6 flex flex-col gap-6">
                    <FormField label="Preferred date" htmlFor="date"><Input id="date" name="date" type="date" required min={new Date().toISOString().slice(0, 10)} /></FormField>
                    <FormField label="Time of day" htmlFor="time"><Select id="time" name="time"><option>Morning</option><option>Afternoon</option><option>Evening</option></Select></FormField>
                    <FormField label="Notes" htmlFor="notes" optional><Input id="notes" name="notes" maxLength={300} placeholder="Bringing products, a team…" /></FormField>
                    {book.isError && <p role="alert" className="text-sm text-danger">{errorMessage(book.error)}</p>}
                    <Button type="submit" variant="white" disabled={book.isPending}>Request my session</Button>
                  </form>
                )}
              </div>
            </div>
          )}
        </Container>
      </Section>

      {/* 03 Introductions */}
      <Section tone="night" className="pt-0 md:pt-0">
        <Container className="flex flex-col gap-14">
          <SectionHeader badgeVariant="solid" badge="03 — Introductions" title="Women You Should Meet" intro={`Neighbors from ${n} first, then across the constellation.`} />
          {!approved ? <Locked /> : (
            <>
              {introsState.isError && <InlineError message="We couldn’t load your introductions." onRetry={() => void introsState.refetch()} />}
              {introsState.isSuccess && intros.length === 0 ? (
                <p className="text-center text-sm text-ink-muted">No introductions yet. As more neighbors join the directory, they’ll appear here.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {intros.map((m) => <MemberCard key={m.id} member={m} variant="catalogue" tone={toneFor(m.neighborhood, hoodList)} catalogueNumber={m.catalogueNumber} />)}
                </div>
              )}
            </>
          )}
        </Container>
      </Section>
    </div>
  );
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-4 text-sm text-ink-muted">
      <p>{message}</p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>Retry</Button>
    </div>
  );
}

function Locked() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-5 rounded-panel border border-dashed border-line p-10 text-center">
      <span aria-hidden className="grid size-12 place-items-center rounded-full bg-surface text-xl">✦</span>
      <p className="font-display text-2xl">Unlocks once you’re welcomed in</p>
      <p className="text-sm text-ink-muted">Members see gatherings, headshot booking, and personal introductions here.</p>
      <Link to="/join" className="text-sm underline underline-offset-4">Haven’t applied yet? Start your application</Link>
    </div>
  );
}
