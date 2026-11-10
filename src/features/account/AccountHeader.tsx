import type * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { cn, formatCatalogueNumber, initials } from "@/index";
import type { Profile } from "@/features/members/queries";
import { useUploadAvatar } from "@/features/members/mutations";
import { bookingQuery } from "@/features/events/queries";
import { Icon, type IconName } from "@/app/layout/icons";
import { Chip, cardFrame } from "@/app/layout/app-ui";
import { ring } from "@/app/layout/app-classes";
import cover from "@/assets/photography/account-cover.webp";
import { errorMessage } from "./helpers";

const shortMonthYear = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "America/New_York" }) : null;
/** A date-only `YYYY-MM-DD` at noon, so no time zone moves it a day. */
const shortDay = (day: string) => new Date(day + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * The cover: one shared landscape (no member uploads a cover), her portrait (click to upload), her name as the
 * page h1, her specialty, role · business and neighborhood, an honest status chip, and a glass panel with her
 * number, join date and headshot — or, before approval, where her application stands. White type sits on the
 * photo's scrim (`app-hero-scrim`).
 */
export function AccountHeader({ userId, profile, avatar, onPreview }: {
  userId: string; profile: Profile; avatar?: string; onPreview: () => void;
}) {
  const upload = useUploadAvatar(userId);
  const approved = profile.status === "approved";
  const declined = profile.status === "declined";
  const booking = useQuery({ ...bookingQuery(userId), enabled: approved }).data;
  const work = [profile.role_title, profile.business].filter((s) => s.trim()).join(" · ");
  const joined = approved ? shortMonthYear(profile.member_since) : null;
  const stats: { value: string; label: string }[] = [
    ...(approved && profile.catalogue_number !== null ? [{ value: `No. ${formatCatalogueNumber(profile.catalogue_number)}`, label: "member" }] : []),
    ...(joined ? [{ value: joined, label: "joined" }] : []),
    ...(booking && booking.status !== "declined"
      ? [{ value: shortDay(booking.preferred_date), label: booking.status === "confirmed" ? "headshot" : "headshot asked" }]
      : []),
  ];
  const waiting = declined
    ? "Your card stays private and isn’t shown to anyone."
    : "Polish your card now — it goes live the day you’re welcomed in.";

  return (
    <section id="profile" aria-labelledby="account-name" className={cn(cardFrame, "relative isolate bg-app-ground text-white")}>
      <img src={cover} alt="" className="absolute inset-0 -z-10 size-full object-cover object-[center_75%]" />
      <div aria-hidden className="app-hero-scrim absolute inset-0 -z-10" />
      <div className="flex min-h-[26.875rem] flex-col gap-6 p-5 sm:p-7 lg:grid lg:grid-cols-[minmax(0,1fr)_21.875rem] lg:grid-rows-[auto_1fr] lg:gap-x-8 lg:pl-10">
        <div className="flex items-start justify-between gap-4 lg:col-span-2">
          <label className="group relative grid size-17 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-app-sunken text-ink shadow-[0_0_0_3px_rgb(255_255_255/0.75),0_10px_24px_-12px_rgb(0_0_0/0.4)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-white has-[:disabled]:cursor-wait">
            {avatar
              ? <img src={avatar} alt="" className="size-full object-cover" />
              : <span aria-hidden className="font-geist text-2xl">{initials(profile.full_name)}</span>}
            <span aria-hidden className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100">
              <Icon name="camera" className="size-5" />
            </span>
            <input
              type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={upload.isPending}
              aria-label={`${avatar ? "Replace" : "Upload"} a portrait (JPG, PNG or WebP, up to 5 MB)`}
              onChange={(e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (file) upload.mutate(file); }}
            />
          </label>
          {approved
            ? <Chip tone="ok" className="gap-1.5 bg-app text-ink shadow-none">Verified member<Icon name="badge-check" className="order-first size-3.5" /></Chip>
            : <Chip tone={declined ? "no" : "pending"} className={cn("shadow-none", declined && "bg-app")}>{declined ? "Application not approved" : "Application under review"}</Chip>}
        </div>

        <div className="mt-auto flex min-w-0 flex-col items-start lg:pb-1.5">
          <h1 id="account-name" className="max-w-full font-geist text-[44px]/[1] font-normal tracking-[-1.5px] break-words sm:text-[64px] lg:text-[80px]/[0.95] lg:tracking-[-3px]">
            {profile.full_name || "Welcome, neighbor"}
          </h1>
          {profile.specialty.trim() && <p className="mt-4 text-[17px]/[1.4] text-white/92">{profile.specialty}</p>}
          {(work || profile.neighborhood) && (
            <p className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-white/88">
              {work && <Meta icon="briefcase">{work}</Meta>}
              {profile.neighborhood && <Meta icon="map-pin">{profile.neighborhood}</Meta>}
            </p>
          )}
          {upload.isError && <p role="alert" className="mt-3 rounded-full bg-app px-3 py-1 text-sm text-danger">{errorMessage(upload.error)}</p>}
        </div>

        <div className="flex flex-col gap-5 self-end rounded-[22px] bg-white/16 p-5.5 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.5)] backdrop-blur-[16px]">
          {stats.length > 0 ? (
            <dl className="flex">
              {stats.map((s, i) => (
                <div key={s.label} className={cn("flex flex-1 flex-col gap-0.5 px-3.5", i === 0 ? "pl-0" : "border-l border-white/30")}>
                  <dt className="order-last text-xs text-white/90">{s.label}</dt>
                  <dd className="text-lg/[1.3] font-medium tracking-[-0.2px] whitespace-nowrap">{s.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-[15px]/[1.5] text-white/92">{waiting}</p>
          )}
          <button type="button" onClick={onPreview} className={cn("inline-flex min-h-12 items-center justify-center rounded-full bg-app px-7 text-[15px] font-medium text-ink transition-colors duration-150 hover:bg-app-sunken", ring)}>
            View public card
          </button>
        </div>
      </div>
    </section>
  );
}

function Meta({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.75"><Icon name={icon} className="size-3.75 opacity-85" />{children}</span>;
}
