import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { cn, formatCatalogueNumber, initials } from "@/index";
import type { Profile } from "@/features/members/queries";
import { useUploadAvatar } from "@/features/members/mutations";
import { bookingQuery, eventsQuery, plansQuery } from "@/features/events/queries";
import { eventWhen } from "@/features/events/format";
import { ring, secondaryButton } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";
import { dayParts, errorMessage } from "./helpers";

const NY = "America/New_York";
const shortMonthYear = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: NY }) : null;

/**
 * The profile head (the canvas's .cover + .phead): two colour fields (hers, picked on her card, and stone) with her
 * round portrait over their edge (click to upload), then a badge for where she stands, her name as the page h1, her
 * Specialty, role · business, and only the facts she or an admin set, each dropped when it is missing. Before approval
 * it says where her application stands instead.
 */
export function AccountHeader({ userId, profile, avatar, onPreview }: {
  userId: string; profile: Profile; avatar?: string; onPreview: () => void;
}) {
  const upload = useUploadAvatar(userId);
  const approved = profile.status === "approved";
  const declined = profile.status === "declined";
  const booking = useQuery({ ...bookingQuery(userId), enabled: approved }).data;
  // Shares the Events card's caches: the next event she is going to.
  const events = useQuery({ ...eventsQuery, enabled: approved }).data ?? [];
  const going = new Set((useQuery({ ...plansQuery(userId), enabled: approved }).data ?? []).filter((p) => p.status === "GOING").map((p) => p.eventId));
  const next = events.find((e) => going.has(e.id));

  const number = approved && profile.catalogue_number !== null ? formatCatalogueNumber(profile.catalogue_number) : null;
  const joined = approved ? shortMonthYear(profile.member_since) : null;
  const hood = profile.neighborhood || null;
  const work = [profile.role_title, profile.business].filter((s) => s.trim()).join(" · ");
  const day = (d: { weekday: string; month: string; day: string }) => `${d.weekday}, ${d.month} ${d.day}`;
  const fields: { label: string; value: string }[] = [
    ...(hood ? [{ label: "Neighborhood", value: hood }] : []),
    ...(number ? [{ label: "Member", value: `No. ${number}` }] : []),
    ...(joined ? [{ label: "Joined", value: joined }] : []),
    ...(booking && booking.status !== "declined"
      ? [{ label: booking.status === "confirmed" ? "Headshot" : "Headshot requested", value: day(dayParts(booking.preferred_date)) }]
      : []),
    ...(next ? [{ label: "Next event", value: day(eventWhen(next.starts_at)) }] : []),
  ];
  const waiting = declined
    ? "We weren’t able to offer you a membership, so your card stays private."
    : "Polish your card while you wait — it stays private until you’re welcomed in, and only appears when you turn on Visibility.";

  return (
    <section id="profile" aria-labelledby="account-name">
      <div aria-hidden className={cn("air-cover", `pass--${profile.card_color ?? "mustard"}`)}><span /><span /></div>
      <div className="air-phead">
        <label className="air-phead-av">
          {avatar ? <img src={avatar} alt="" /> : <span aria-hidden>{initials(profile.full_name)}</span>}
          {/* Always there, not only on hover: a touch screen has no hover to say the portrait can be changed. */}
          <span aria-hidden className="air-photo-btn"><Icon name="camera" className="size-3.75" /></span>
          <input
            type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={upload.isPending}
            aria-label={`${avatar ? "Replace" : "Upload"} a portrait (JPG, PNG or WebP, up to 5 MB)`}
            onChange={(e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (file) upload.mutate(file); }}
          />
        </label>
        <div className="air-phead-txt">
          <h1 id="account-name"><NameLine name={profile.full_name || "Welcome, neighbor"} /></h1>
          {(profile.specialty.trim() || work) && <p className="air-role">{[profile.specialty.trim(), work].filter(Boolean).join(" · ")}</p>}
        </div>
        <div className="air-phead-tags">
          <span className="twc-flag">{approved ? "Verified member" : declined ? "Application not approved" : "Application under review"}</span>
          {/* A declined account has no card to show anyone, so nothing to preview. */}
          {!declined && (
            <button type="button" onClick={onPreview} className={secondaryButton}>
              View directory card <Icon name="arrow-right" />
            </button>
          )}
        </div>
      </div>
      {upload.isError && <p role="alert" className="mt-3 text-sm text-danger">{errorMessage(upload.error)}</p>}
      {fields.length > 0 && (
        <dl className="air-addr">
          {fields.map((f) => (
            <div key={f.label}><dt className="air-lbl">{f.label}</dt><dd>{f.value}</dd></div>
          ))}
        </dl>
      )}
      {!approved && (
        <p className="air-waiting">
          {waiting}{declined && <> <Link to="/contact" className={cn("air-link", ring)}>Have a question? Contact us</Link></>}
        </p>
      )}
    </section>
  );
}

/** Her name as the canvas sets it: the first word upright, the rest in italic. */
function NameLine({ name }: { name: string }) {
  const [first, ...rest] = name.split(" ");
  return rest.length ? <>{first} <i>{rest.join(" ")}</i></> : <>{name}</>;
}
