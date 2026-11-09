import { initials } from "@/index";
import type { Profile } from "@/features/members/queries";
import { useUploadAvatar } from "@/features/members/mutations";
import { Icon } from "@/app/layout/icons";
import { Chip, cardFrame } from "@/app/layout/app-ui";
import { errorMessage, monthYear } from "./helpers";

/** The welcome card: portrait (click to upload), a script hello, her name as the page h1, and an honest status. */
export function AccountHeader({ userId, profile, avatar }: { userId: string; profile: Profile; avatar?: string }) {
  const upload = useUploadAvatar(userId);
  const approved = profile.status === "approved";
  const declined = profile.status === "declined";
  const since = monthYear(profile.member_since);
  const subline = approved
    ? [profile.catalogue_number !== null && `Member No. ${profile.catalogue_number}`, `Approved member${since ? ` since ${since}` : ""}`].filter(Boolean).join(" · ")
    : declined
      ? "Your card stays private and isn’t shown to anyone."
      : "Polish your card now — it goes live the day you’re welcomed in.";

  return (
    <section id="profile" aria-labelledby="account-name" className={`${cardFrame} flex flex-wrap items-center gap-x-7 gap-y-6 p-5 sm:p-7`}>
      <label className="group relative grid size-28 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-app-sunken has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-app-accent has-[:disabled]:cursor-wait">
        {avatar
          ? <img src={avatar} alt="" className="size-full object-cover" />
          : <span aria-hidden className="font-display text-[38px] text-ink">{initials(profile.full_name)}</span>}
        <span aria-hidden className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100">
          <Icon name="camera" className="size-6" />
        </span>
        <input
          type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={upload.isPending}
          aria-label={`${avatar ? "Replace" : "Upload"} a portrait (JPG, PNG or WebP, up to 5 MB)`}
          onChange={(e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (file) upload.mutate(file); }}
        />
      </label>

      <div className="flex min-w-0 flex-[1_1_18rem] flex-col items-start gap-2">
        <p className="font-script text-[34px]/[1.1] text-app-accent">welcome, neighbor</p>
        <h1 id="account-name" className="max-w-full font-display text-[34px]/[1.1] tracking-[-0.5px] break-words text-ink sm:text-[44px]/[1.09]">
          {profile.full_name || "Welcome, neighbor"}
        </h1>
        {approved
          ? <Chip tone="ok" className="gap-1.5"><Icon name="badge-check" className="size-3.5" />Verified member</Chip>
          : <Chip tone={declined ? "no" : "pending"}>{declined ? "Application not approved" : "Application under review"}</Chip>}
        <p className="text-[15px] text-app-muted">{subline}</p>
        {upload.isError && <p role="alert" className="text-sm text-danger">{errorMessage(upload.error)}</p>}
      </div>
    </section>
  );
}
