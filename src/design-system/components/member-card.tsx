import * as React from "react";
import { CurvedLoop } from "./curved-loop";
import { BorderGlow } from "./border-glow";
import { ProximityText } from "./proximity-text";
import { cva, type VariantProps } from "class-variance-authority";
import type { MemberProfile } from "../data/members";
import { cn } from "../lib/utils";
import { Badge } from "./typography";

const cardVariants = cva("group border border-line bg-canvas text-ink transition-[transform,box-shadow] duration-base ease-gentle hover:-translate-y-1 hover:shadow-soft motion-reduce:transform-none motion-reduce:transition-none", {
  variants: {
    variant: {
      grid: "rounded-card overflow-hidden",
      featured: "grid rounded-panel overflow-hidden md:grid-cols-[1.05fr_1fr]",
      catalogue: "rounded-panel bg-canvas text-ink hover:-translate-y-1.5",
    },
  },
  defaultVariants: { variant: "grid" },
});

/**
 * Catalogue cards carry a neighborhood color signature so each member reads at
 * a glance from the shared palette. Unknown neighborhoods fall back to the
 * neutral catalogue look.
 */
const catalogueTones: Record<string, { rule: string; label: string; index: string; wash: string; glow: string }> = {
  "Long Island City": { rule: "border-lic", label: "text-lic", index: "text-lic", wash: "bg-lic", glow: "--color-lic" },
  Astoria: { rule: "border-astoria", label: "text-astoria", index: "text-astoria", wash: "bg-astoria", glow: "--color-astoria" },
  Sunnyside: { rule: "border-sunnyside", label: "text-sunnyside", index: "text-sunnyside", wash: "bg-sunnyside", glow: "--color-sunnyside" },
  "Jackson Heights": { rule: "border-jackson-heights", label: "text-jackson-heights", index: "text-jackson-heights", wash: "bg-jackson-heights", glow: "--color-jackson-heights" },
  "Forest Hills": { rule: "border-forest-hills", label: "text-forest-hills", index: "text-forest-hills", wash: "bg-forest-hills", glow: "--color-forest-hills" },
  Elmhurst: { rule: "border-elmhurst", label: "text-elmhurst", index: "text-elmhurst", wash: "bg-elmhurst", glow: "--color-elmhurst" },
  "Rego Park": { rule: "border-rego-park", label: "text-rego-park", index: "text-rego-park", wash: "bg-rego-park", glow: "--color-rego-park" },
};

export interface MemberCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "children">, VariantProps<typeof cardVariants> {
  member: MemberProfile;
  catalogueNumber?: number;
}

/**
 * Use MemberCard for a public directory or a curated member preview.
 * @example <MemberCard member={member} />
 * @example <MemberCard member={member} variant="featured" />
 * @example <MemberCard member={member} variant="catalogue" catalogueNumber={1} />
 * Catalogue cards pick up the member’s neighborhood color from the palette;
 * members sharing a neighborhood share its color.
 * Avoid placing MemberCard inside another card or supplying unapproved personal details.
 */
export const MemberCard = React.forwardRef<HTMLElement, MemberCardProps>(({ catalogueNumber, className, member, variant, ...props }, ref) => {
  const tone = variant === "catalogue" ? catalogueTones[member.neighborhood] : undefined;
  return (
  <article ref={ref} className={cn(cardVariants({ variant }), className)} {...props}>
    {variant === "catalogue" ? (
      <>
        <BorderGlow className="rounded-panel" glowVar={tone?.glow ?? "--color-sky"} glowRadius={28} fillOpacity={0.25}>
          <div className={cn("flex min-h-[20rem] flex-col border-b border-line p-6 sm:min-h-[23rem] sm:p-8 xl:min-h-[18rem] xl:p-5", tone?.rule)}>
          <div className="flex items-start justify-between gap-4 xl:gap-2">
            <CurvedLoop
              marqueeText="The Women’s Collective ✦ Member catalogue"
              className="min-w-0 max-w-[14rem] flex-1 text-ink-muted xl:max-w-[12rem]"
              speed={0.8}
              curveAmount={48}
            />
            <span
              aria-label={`Catalogue number ${catalogueNumber ?? 1}`}
              className={cn("grid size-14 shrink-0 place-items-center rounded-full border text-lg tabular-nums sm:size-16 sm:text-xl xl:size-12 xl:text-base", tone?.rule, tone?.index)}
            >
              {String(catalogueNumber ?? 1).padStart(2, "0")}
            </span>
          </div>

          <div className="mt-auto flex items-end justify-between gap-5">
            <div className="min-w-0">
              <h3 className="max-w-[10ch] text-balance font-display text-5xl font-normal leading-[0.96] sm:text-6xl lg:text-7xl xl:text-5xl">
                <ProximityText text={member.name} />
              </h3>
              <div className="mt-5 flex items-center gap-4 text-sm text-ink-muted sm:text-base xl:mt-4 xl:text-sm">
                <p className="min-w-0 leading-snug">{member.role}</p>
              </div>
            </div>
            <p
              className={cn(
                "flex shrink-0 items-start gap-3 [writing-mode:vertical-rl] [transform:rotate(180deg)]",
                tone?.label,
              )}
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                <circle cx="12" cy="10" r="2.25" />
              </svg>
              <span className="leading-none">{member.neighborhood}</span>
            </p>
          </div>
          </div>
        </BorderGlow>

        <div className={cn("p-3 sm:p-4 xl:p-3", tone?.wash ?? "bg-surface")}>
          <div className="aspect-[4/5] overflow-hidden rounded-card bg-surface">
            <img
              src={member.image}
              alt={member.imageAlt}
              loading="lazy"
              width={768}
              height={1024}
              className="size-full object-cover grayscale transition-[filter,transform] duration-slow ease-gentle group-hover:scale-[1.025] group-hover:grayscale-0 motion-reduce:transform-none motion-reduce:transition-none"
            />
          </div>
        </div>

        <div className="grid min-h-32 grid-cols-[minmax(0,1fr)_auto] items-center gap-6 border-t border-line p-6 sm:p-8 xl:min-h-28 xl:gap-3 xl:p-5">
          <div className="min-w-0">
            <span aria-hidden className={cn("mb-4 block h-0.5 w-7 xl:mb-3", tone?.wash ?? "bg-surface-strong")} />
            <p className="font-display text-2xl font-normal leading-tight text-ink sm:text-3xl xl:text-xl">{member.business}</p>
            <p className="mt-2 text-xs uppercase leading-relaxed text-ink-muted">{member.specialty}</p>
          </div>
          <span aria-hidden className={cn("grid size-14 shrink-0 place-items-center rounded-full border text-2xl transition-transform duration-base ease-gentle group-hover:translate-x-1 motion-reduce:transform-none xl:size-11 xl:text-xl", tone?.rule, tone?.index)}>→</span>
        </div>
      </>
    ) : (
      <>
    <div className={cn("relative overflow-hidden bg-surface", variant === "featured" ? "min-h-96 md:min-h-[34rem]" : "aspect-[4/5]")}>
      <img
        src={member.image}
        alt={member.imageAlt}
        loading="lazy"
        width={768}
        height={1024}
        className="size-full object-cover transition-transform duration-slow ease-gentle group-hover:scale-[1.025] motion-reduce:transform-none motion-reduce:transition-none"
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
      <Badge variant="glass" className="absolute bottom-5 left-5 text-white">{member.neighborhood}</Badge>
    </div>
    <div className={cn("flex flex-col", variant === "featured" ? "justify-center gap-7 p-8 md:p-12" : "gap-5 p-6")}>
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-ink-muted">{member.specialty}</p>
        <h3 className={cn("font-display leading-tight", variant === "featured" ? "text-4xl md:text-5xl" : "text-3xl")}>{member.name}</h3>
        <p className="mt-2 text-sm text-ink-muted">{member.role} · {member.business}</p>
      </div>
      <p className="text-base leading-relaxed text-ink-muted">{member.bio}</p>
      <div className="border-t border-line pt-4">
        <p className="text-xs font-medium uppercase text-ink-muted">Looking to meet</p>
        <p className="mt-2 font-display text-xl leading-snug">{member.lookingFor}</p>
      </div>
    </div>
      </>
    )}
  </article>
  );
});
MemberCard.displayName = "MemberCard";
