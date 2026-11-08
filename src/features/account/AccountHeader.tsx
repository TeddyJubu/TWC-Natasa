import { cn, initials } from "@/index";
import type { Profile } from "@/features/members/queries";
import { useUploadAvatar } from "@/features/members/mutations";
import { errorMessage, monthYear } from "./helpers";
import { Icon } from "./icons";
import { Chip } from "./shared";

// The design's 19 × 5 grid of 58px cells: a few warm and grey ones, faded out toward the name.
const COLS = 19;
const WARM = new Set([3, 13]);
const GREY = new Set([28, 34, 39, 44, 68]);

/** Portrait (click to upload), her name as the page h1, and an honest membership line. */
export function AccountHeader({ userId, profile, avatar }: { userId: string; profile: Profile; avatar?: string }) {
  const upload = useUploadAvatar(userId);
  const approved = profile.status === "approved";
  const declined = profile.status === "declined";
  const since = monthYear(profile.member_since);
  const subline = approved
    ? [profile.catalogue_number !== null && `Member No. ${profile.catalogue_number}`, `Approved member${since ? ` since ${since}` : ""}`].filter(Boolean).join(" · ")
    : declined
      ? "Application not approved · Your card stays private and isn’t shown to anyone."
      : "Application under review · Polish your card now — it goes live the day you’re welcomed in.";

  return (
    <section id="profile" aria-labelledby="account-name" className="relative flex scroll-mt-24 flex-col items-start gap-4.5 overflow-hidden px-4 pt-11 pb-9 sm:px-8 lg:px-14">
      <div aria-hidden className="absolute top-0 left-0 grid grid-cols-[repeat(19,58px)] grid-rows-[repeat(5,58px)]">
        {Array.from({ length: COLS * 5 }, (_, i) => (
          <span key={i} className={cn("border border-app-rule", WARM.has(i) ? "bg-app-tint" : GREY.has(i) && "bg-app-rule/60")} />
        ))}
      </div>
      <div aria-hidden className="absolute inset-x-0 top-0 h-[290px] bg-linear-to-b from-transparent from-35% to-app" />

      <label className="group relative z-[2] grid size-29 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-ink shadow-[0_6px_18px_rgb(0_0_0/0.08)] outline-4 -outline-offset-2 outline-app has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-4 has-[:focus-visible]:ring-offset-app has-[:disabled]:cursor-wait">
        {avatar
          ? <img src={avatar} alt="" className="size-full object-cover" />
          : <span aria-hidden className="font-display text-[38px] text-canvas">{initials(profile.full_name)}</span>}
        <span aria-hidden className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-has-[:focus-visible]:opacity-100">
          <Icon name="camera" className="size-6" />
        </span>
        <input
          type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={upload.isPending}
          aria-label={`${avatar ? "Replace" : "Upload"} a portrait (JPG, PNG or WebP, up to 5 MB)`}
          onChange={(e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (file) upload.mutate(file); }}
        />
      </label>

      <div className="relative z-[3] flex max-w-full flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 id="account-name" className="text-[28px] leading-tight font-medium tracking-[-0.6px] break-words text-ink sm:text-[36px]">
            {profile.full_name || "Welcome, Neighbor"}
          </h1>
          {approved
            ? <span role="img" aria-label="Verified member" className="self-start text-app-accent"><Icon name="badge-check" className="size-5.5" /></span>
            : <Chip>{declined ? "Not approved" : "In review"}</Chip>}
        </div>
        <p className="text-base text-app-muted">{subline}</p>
        {upload.isError && <p role="alert" className="text-sm text-danger">{errorMessage(upload.error)}</p>}
      </div>
    </section>
  );
}
