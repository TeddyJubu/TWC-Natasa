import { Badge, Container, Heading, type MemberCardTone, Section, Text, cn, initials } from "@/index";
import type { Profile } from "@/features/members/queries";
import { hoodStyle } from "./helpers";

/** Portrait (or initials), status badge, and the catalogue / member-since / neighborhood facts. */
export function AccountHeader({
  profile, avatar, approved, declined, neighborhood: n, tone,
}: {
  profile: Profile;
  avatar?: string;
  approved: boolean;
  declined: boolean;
  /** Her neighborhood, or null when she hasn't chosen one. */
  neighborhood: string | null;
  tone?: MemberCardTone;
}) {
  const since = profile.member_since ? new Date(profile.member_since).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—";
  return (
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
            <div><dt className="text-xs uppercase text-ink-muted">Neighborhood</dt><dd className={cn("mt-2 font-display text-2xl md:text-3xl", tone && "text-(--hood)")} style={hoodStyle(tone?.color)}>{n ?? "—"}</dd></div>
          </dl>
        </div>
      </Container>
    </Section>
  );
}
