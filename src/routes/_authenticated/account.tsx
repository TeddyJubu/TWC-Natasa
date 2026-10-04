import * as React from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge, BrandLockup, Button, Container, FileUpload, FormActions, FormField, FormNotice, FormSection, Heading,
  Input, MemberCard, Navbar, Section, SectionHeader, Select, Switch, Text, Textarea, cn, type MemberProfile,
} from "@/index";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { avatarUrls, initials, neighborhoods } from "@/lib/account";
import { demoMembers } from "@/design-system/data/members";
import hero from "@/assets/photography/hero.jpg";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
type Booking = Database["public"]["Tables"]["headshot_bookings"]["Row"];

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

const wash: Record<string, string> = {
  "Long Island City": "bg-lic", Astoria: "bg-astoria", Sunnyside: "bg-sunnyside", "Jackson Heights": "bg-jackson-heights",
  "Forest Hills": "bg-forest-hills", Elmhurst: "bg-elmhurst", "Rego Park": "bg-rego-park",
};
const ink: Record<string, string> = {
  "Long Island City": "text-lic", Astoria: "text-astoria", Sunnyside: "text-sunnyside", "Jackson Heights": "text-jackson-heights",
  "Forest Hills": "text-forest-hills", Elmhurst: "text-elmhurst", "Rego Park": "text-rego-park",
};

function toMember(p: Profile, image?: string): MemberProfile {
  return {
    id: p.id, name: p.full_name || "Your name", role: p.role_title || "Your role", business: p.business || "Your business",
    neighborhood: p.neighborhood, specialty: p.specialty || "Your specialty", bio: p.bio, lookingFor: p.looking_for,
    image: image ?? hero, imageAlt: `Portrait of ${p.full_name || "member"}`,
  };
}

function AccountPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [avatar, setAvatar] = React.useState<string>();
  const [events, setEvents] = React.useState<EventRow[]>([]);
  const [rsvps, setRsvps] = React.useState<Set<string>>(new Set());
  const [booking, setBooking] = React.useState<Booking | null>(null);
  const [intros, setIntros] = React.useState<{ members: MemberProfile[]; sample: boolean }>({ members: [], sample: true });
  const [saveState, setSaveState] = React.useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (!p) return;
    setProfile(p);
    if (p.avatar_path) setAvatar((await avatarUrls([p.avatar_path]))[p.avatar_path]);
    if (p.status !== "approved") return;
    const [{ data: ev }, { data: rs }, { data: bk }, { data: others }] = await Promise.all([
      supabase.from("events").select("*").gte("starts_at", new Date().toISOString()).order("starts_at"),
      supabase.from("event_rsvps").select("event_id"),
      supabase.from("headshot_bookings").select("*").maybeSingle(),
      supabase.from("profiles").select("*").neq("id", user.id).eq("status", "approved").eq("directory_visible", true).limit(12),
    ]);
    setEvents(ev ?? []);
    setRsvps(new Set((rs ?? []).map((r) => r.event_id)));
    setBooking(bk ?? null);
    const rank = (n: string) => (n === p.neighborhood ? 0 : 1);
    if (others && others.length) {
      const urls = await avatarUrls(others.map((o) => o.avatar_path));
      setIntros({ sample: false, members: [...others].sort((a, b) => rank(a.neighborhood) - rank(b.neighborhood)).slice(0, 4).map((o) => toMember(o, o.avatar_path ? urls[o.avatar_path] : undefined)) });
    } else {
      setIntros({ sample: true, members: [...demoMembers].sort((a, b) => rank(a.neighborhood) - rank(b.neighborhood)).slice(0, 4) });
    }
  }, [user.id]);

  React.useEffect(() => { void load(); }, [load]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    const f = new FormData(e.currentTarget);
    const patch = {
      full_name: String(f.get("full_name") ?? "").trim(), role_title: String(f.get("role_title") ?? "").trim(),
      business: String(f.get("business") ?? "").trim(), neighborhood: String(f.get("neighborhood") ?? profile.neighborhood),
      specialty: String(f.get("specialty") ?? "").trim(), website: String(f.get("website") ?? "").trim(),
      bio: String(f.get("bio") ?? "").trim().slice(0, 400), looking_for: String(f.get("looking_for") ?? "").trim().slice(0, 160),
      directory_visible: f.get("directory_visible") === "on",
    };
    setSaveState("loading"); setError(null);
    const { data, error } = await supabase.from("profiles").update(patch).eq("id", profile.id).select().single();
    if (error) { setError(error.message); setSaveState("idle"); return; }
    setProfile(data); setSaveState("success");
    setTimeout(() => setSaveState("idle"), 1800);
  }

  async function uploadAvatar(file: File) {
    if (!profile) return;
    const path = `${profile.id}/avatar-${Date.now()}.${file.name.split(".").pop() ?? "jpg"}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { setError(error.message); return; }
    const { data } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", profile.id).select().single();
    if (data) setProfile(data);
    setAvatar((await avatarUrls([path]))[path]);
  }

  async function toggleRsvp(id: string) {
    const next = new Set(rsvps);
    if (next.has(id)) { await supabase.from("event_rsvps").delete().eq("event_id", id); next.delete(id); }
    else { await supabase.from("event_rsvps").insert({ event_id: id, user_id: user.id }); next.add(id); }
    setRsvps(next);
  }

  async function bookHeadshot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { data } = await supabase.from("headshot_bookings").upsert({
      user_id: user.id, preferred_date: String(f.get("date")), preferred_time: String(f.get("time")), notes: String(f.get("notes") ?? "").slice(0, 300),
    }, { onConflict: "user_id" }).select().single();
    if (data) setBooking(data);
  }

  if (!profile) {
    return <div className="grid min-h-screen place-items-center bg-canvas"><span className="size-6 animate-spin rounded-full border-2 border-ink border-t-transparent" aria-label="Loading your profile" /></div>;
  }

  const approved = profile.status === "approved";
  const n = profile.neighborhood;
  const since = profile.member_since ? new Date(profile.member_since).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—";

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Navbar
        brand={<Link to="/" aria-label="Home"><BrandLockup compact /></Link>}
        links={[{ label: "Home", href: "/" }, { label: "Members", href: "/members" }, { label: "Profile", href: "/account" }]}
        action={<Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>}
      />

      {/* Header */}
      <Section tone="night" className="overflow-hidden pt-16 md:pt-24">
        <Container className="grid items-end gap-12 md:grid-cols-[0.8fr_1.2fr] md:gap-20">
          <div className={cn("motion-reveal relative aspect-[4/5] w-full max-w-sm rounded-card p-4", wash[n] ?? "bg-surface")}>
            {avatar
              ? <img src={avatar} alt={`Portrait of ${profile.full_name}`} className="size-full rounded-control object-cover" />
              : <div className="grid size-full place-items-center rounded-control bg-canvas font-display text-8xl text-ink">{initials(profile.full_name)}</div>}
            <span className="absolute -right-3 -top-3 rounded-full bg-sun px-4 py-2 text-xs text-sun-ink">{approved ? `No. ${String(profile.catalogue_number ?? 0).padStart(2, "0")}` : "In review"}</span>
          </div>
          <div className="motion-stagger flex flex-col gap-7">
            <Badge variant="solid">{approved ? "Approved member" : "Application pending"}</Badge>
            <Heading as="h1" size="display" className="break-words">{profile.full_name || "Welcome, Neighbor"}</Heading>
            <Text size="lg" tone="muted">{[profile.role_title, profile.business].filter(Boolean).join(" · ") || "Add your role and business below so neighbors know what you do."}</Text>
            <dl className="grid grid-cols-3 gap-6 border-t border-line pt-6">
              <div><dt className="text-xs uppercase text-ink-muted">Catalogue</dt><dd className="mt-2 font-display text-4xl">{approved ? String(profile.catalogue_number ?? 0).padStart(2, "0") : "—"}</dd></div>
              <div><dt className="text-xs uppercase text-ink-muted">Member since</dt><dd className="mt-2 font-display text-2xl md:text-3xl">{since}</dd></div>
              <div><dt className="text-xs uppercase text-ink-muted">Neighborhood</dt><dd className={cn("mt-2 font-display text-2xl md:text-3xl", ink[n])}>{n}</dd></div>
            </dl>
          </div>
        </Container>
      </Section>

      {!approved && (
        <div className="bg-sun py-3 text-center text-sm text-sun-ink">Your application is being reviewed. Polish your card now — it goes live the day you’re welcomed in.</div>
      )}

      {/* 01 Public card */}
      <Section>
        <Container className="flex flex-col gap-16">
          <SectionHeader badge="01 — Your public card" title="How Neighbors Will Meet You" intro="This is what appears in the member directory when you choose to be visible." />
          <div className="grid gap-14 lg:grid-cols-[1.4fr_0.8fr]">
            <form onSubmit={saveProfile} className="flex flex-col gap-14">
              <FormSection index="A" title="The Basics" description="Your name and the work you’re known for.">
                <div className="grid gap-8 md:grid-cols-2">
                  <FormField label="Full name" htmlFor="full_name" index="01"><Input id="full_name" name="full_name" defaultValue={profile.full_name} required maxLength={80} /></FormField>
                  <FormField label="Role" htmlFor="role_title" index="02"><Input id="role_title" name="role_title" defaultValue={profile.role_title} maxLength={80} placeholder="Founder & Designer" /></FormField>
                  <FormField label="Business" htmlFor="business" index="03"><Input id="business" name="business" defaultValue={profile.business} maxLength={80} /></FormField>
                  <FormField label="Specialty" htmlFor="specialty" index="04"><Input id="specialty" name="specialty" defaultValue={profile.specialty} maxLength={60} placeholder="Food & hospitality" /></FormField>
                  <FormField label="Neighborhood" htmlFor="neighborhood" index="05">
                    <Select id="neighborhood" name="neighborhood" defaultValue={profile.neighborhood}>{neighborhoods.map((x) => <option key={x}>{x}</option>)}</Select>
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
                  <FileUpload label="Upload a portrait" hint="JPG or PNG, up to 5MB" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.currentTarget.files?.[0]; if (file) void uploadAvatar(file); }} />
                  <Switch name="directory_visible" defaultChecked={profile.directory_visible} label="Show me in the member directory" description="Only appears once your membership is approved." />
                </div>
              </FormSection>
              {error && <p role="alert" className="text-sm text-danger">{error}</p>}
              <FormActions><Button type="submit" variant="ink" state={saveState}>Save my card</Button></FormActions>
            </form>
            <aside className="lg:sticky lg:top-32 lg:self-start">
              <p className="mb-4 text-xs uppercase text-ink-muted">Live preview</p>
              <div className="rounded-panel bg-black p-4">
                <MemberCard member={toMember(profile, avatar)} variant="catalogue" catalogueNumber={profile.catalogue_number ?? 0} />
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
              <ol className="flex flex-col border-t border-line">
                {events.map((ev) => {
                  const d = new Date(ev.starts_at);
                  const going = rsvps.has(ev.id);
                  return (
                    <li key={ev.id} className="motion-scroll-reveal grid grid-cols-[4.5rem_1fr] gap-6 border-b border-line py-7 sm:grid-cols-[4.5rem_1fr_auto] sm:items-center">
                      <div className="text-center"><p className={cn("text-xs uppercase", ink[ev.neighborhood])}>{d.toLocaleDateString("en-US", { month: "short" })}</p><p className="font-display text-5xl leading-none">{d.getDate()}</p></div>
                      <div className="min-w-0">
                        <h3 className="font-display text-2xl">{ev.title}</h3>
                        <p className="mt-1 text-sm text-ink-muted">{ev.location} · {ev.neighborhood} · {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                        <p className="mt-2 text-sm text-ink-muted">{ev.description}</p>
                      </div>
                      <Button size="sm" variant={going ? "white" : "outline"} aria-pressed={going} onClick={() => toggleRsvp(ev.id)} className="col-start-2 justify-self-start sm:col-start-3">{going ? "✓ You’re going" : "Save my seat"}</Button>
                    </li>
                  );
                })}
              </ol>
              <div className="rounded-panel border border-line p-7">
                <Badge variant="solid">Headshot session</Badge>
                <h3 className="mt-5 font-display text-3xl">Your Portrait, Professionally Done</h3>
                {booking ? (
                  <FormNotice className="mt-6" title="Request received" tone="accent">
                    {new Date(booking.preferred_date + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {booking.preferred_time}. We’ll confirm by email.
                    <button type="button" className="mt-3 block underline underline-offset-4" onClick={() => setBooking(null)}>Change request</button>
                  </FormNotice>
                ) : (
                  <form onSubmit={bookHeadshot} className="mt-6 flex flex-col gap-6">
                    <FormField label="Preferred date" htmlFor="date"><Input id="date" name="date" type="date" required min={new Date().toISOString().slice(0, 10)} /></FormField>
                    <FormField label="Time of day" htmlFor="time"><Select id="time" name="time"><option>Morning</option><option>Afternoon</option><option>Evening</option></Select></FormField>
                    <FormField label="Notes" htmlFor="notes" optional><Input id="notes" name="notes" maxLength={300} placeholder="Bringing products, a team…" /></FormField>
                    <Button type="submit" variant="white">Request my session</Button>
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {intros.members.map((m, i) => <MemberCard key={m.id} member={m} variant="catalogue" catalogueNumber={i + 1} />)}
              </div>
              {intros.sample && <p className="text-center text-xs text-ink-muted">Sample profiles shown until more members join the directory.</p>}
            </>
          )}
        </Container>
      </Section>
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
