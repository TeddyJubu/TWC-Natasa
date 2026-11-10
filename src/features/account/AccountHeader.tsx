import { useQuery } from "@tanstack/react-query";
import { formatCatalogueNumber, initials } from "@/index";
import type { Profile } from "@/features/members/queries";
import { useUploadAvatar } from "@/features/members/mutations";
import { bookingQuery, eventsQuery, rsvpsQuery } from "@/features/events/queries";
import { eventWhen } from "@/features/events/format";
import { redButton } from "@/app/layout/app-classes";
import { Icon } from "@/app/layout/icons";
import { dayParts, errorMessage } from "./helpers";

const NY = "America/New_York";
const shortMonthYear = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: NY }) : null;

/**
 * The cover: an airmail envelope holding her member pass. Her portrait is the stamp (click to upload), her name the
 * page h1, her Specialty under it, then role · business, and the pass's fields — only facts she or an admin set,
 * each dropped when it is missing. The postmark carries her join date; before approval the pass says where her
 * application stands instead.
 */
export function AccountHeader({ userId, profile, avatar, onPreview }: {
  userId: string; profile: Profile; avatar?: string; onPreview: () => void;
}) {
  const upload = useUploadAvatar(userId);
  const approved = profile.status === "approved";
  const declined = profile.status === "declined";
  const booking = useQuery({ ...bookingQuery(userId), enabled: approved }).data;
  // Shares the Gatherings card's cache: her next RSVP'd gathering.
  const events = useQuery({ ...eventsQuery, enabled: approved }).data ?? [];
  const rsvps = new Set(useQuery({ ...rsvpsQuery(userId), enabled: approved }).data ?? []);
  const next = events.find((e) => rsvps.has(e.id));

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
    ...(next ? [{ label: "Next gathering", value: day(eventWhen(next.starts_at)) }] : []),
  ];
  const waiting = declined
    ? "Your card stays private and isn’t shown to anyone."
    : "Polish your card now — it goes live the day you’re welcomed in.";
  const postmark = approved && profile.member_since ? new Date(profile.member_since) : null;
  const band = profile.business.trim() || profile.role_title.trim();

  return (
    <section id="profile" aria-labelledby="account-name" className="air-env">
      <div className="air-env-in">
        <p className="air-pass-top">
          <span><b>Par avion</b> · Member pass</span>
          {joined && <span>Valid · {joined}</span>}
        </p>

        <div className="air-post">
          <label className="air-stamp">
            <div className="air-stamp-paper">
              <div className="air-stamp-face">
                {avatar ? <img src={avatar} alt="" /> : <span aria-hidden className="air-stamp-initials">{initials(profile.full_name)}</span>}
                {number && <span aria-hidden className="air-stamp-val">{Number(profile.catalogue_number)}¢</span>}
                <div aria-hidden className="air-stamp-band">
                  <b>{band}</b>{hood && <span>{hood} post</span>}
                </div>
              </div>
            </div>
            {/* Always there, not only on hover: a touch screen has no hover to say the portrait can be changed. */}
            <span aria-hidden className="air-photo-btn"><Icon name="camera" className="size-3.75" /></span>
            <input
              type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={upload.isPending}
              aria-label={`${avatar ? "Replace" : "Upload"} a portrait (JPG, PNG or WebP, up to 5 MB)`}
              onChange={(e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (file) upload.mutate(file); }}
            />
          </label>
          <Postmark hood={hood} date={postmark} />
        </div>

        {approved ? (
          <p className="air-seal">
            <Icon name="badge-check" className="size-3.75" /><span>Verified member</span>
          </p>
        ) : (
          <p className="air-seal air-seal--status">{declined ? "Application not approved" : "Application under review"}</p>
        )}

        <div className="air-stub">
          <h1 id="account-name">{profile.full_name || "Welcome, neighbor"}</h1>
          {profile.specialty.trim() && <p className="air-tag">{profile.specialty}</p>}
          {work && <p className="air-role">{work}</p>}
          {upload.isError && <p role="alert" className="mt-3 text-sm text-danger">{errorMessage(upload.error)}</p>}
          {fields.length > 0 && (
            <dl className="air-addr">
              {fields.map((f) => (
                <div key={f.label}><dt className="air-lbl">{f.label}</dt><dd>{f.value}</dd></div>
              ))}
            </dl>
          )}
          {!approved && <p className="air-waiting">{waiting}</p>}
          <div className="air-code">
            {number ? (
              <div aria-hidden>
                <div className="air-bars" />
                <p className="air-code-id">WC-{number}{hood ? `-${hood.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase()}` : ""}</p>
              </div>
            ) : <span />}
            <button type="button" onClick={onPreview} className={redButton}>
              View public card <Icon name="arrow-right" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

const WAVE = "q12.5 -8 25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0 t25 0";

/** The cancellation over the stamp: wavy lines, and once she has joined, a ring dated the day she did. */
function Postmark({ hood, date }: { hood: string | null; date: Date | null }) {
  const part = (o: Intl.DateTimeFormatOptions) => date!.toLocaleDateString("en-US", { timeZone: NY, ...o }).toUpperCase();
  return (
    <svg aria-hidden viewBox="0 0 330 120" className="air-cancel">
      <defs><path id="air-ring" d="M236 60 a34 34 0 1 1 68 0 a34 34 0 1 1 -68 0" /></defs>
      <g fill="none" stroke="var(--bl-air-red)" strokeWidth="3" strokeLinecap="round">
        {[38, 52, 66, 80].map((y) => <path key={y} d={`M4 ${y} ${WAVE}`} />)}
      </g>
      {date && (
        <g fill="var(--bl-air-red)">
          <circle cx="270" cy="60" r="51" fill="none" stroke="var(--bl-air-red)" strokeWidth="2.6" />
          <circle cx="270" cy="60" r="43" fill="none" stroke="var(--bl-air-red)" strokeWidth="1.1" />
          <text fontFamily="var(--font-plex)" fontSize="7.6" fontWeight="600" letterSpacing="1.7">
            <textPath href="#air-ring">{hood ? `${hood.toUpperCase()} · ` : ""}QUEENS, NY · AIR MAIL ·</textPath>
          </text>
          <text x="270" y="59" textAnchor="middle" fontFamily="var(--font-gilda)" fontSize="16" fontWeight="400">{part({ day: "numeric" })} {part({ month: "short" })}</text>
          <text x="270" y="73" textAnchor="middle" fontFamily="var(--font-plex)" fontSize="9" fontWeight="600" letterSpacing="1.6">{part({ year: "numeric" })}</text>
        </g>
      )}
    </svg>
  );
}
