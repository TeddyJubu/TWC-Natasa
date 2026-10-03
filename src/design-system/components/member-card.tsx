import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import type { MemberProfile } from "../data/members";
import { cn } from "../lib/utils";
import { Badge } from "./typography";

const cardVariants = cva("group overflow-hidden border border-line bg-canvas text-ink transition-[transform,box-shadow] duration-base ease-gentle hover:-translate-y-1 hover:shadow-soft motion-reduce:transform-none motion-reduce:transition-none", {
  variants: {
    variant: {
      grid: "rounded-card",
      featured: "grid rounded-panel md:grid-cols-[1.05fr_1fr]",
      catalogue: "rounded-card bg-canvas text-ink",
    },
  },
  defaultVariants: { variant: "grid" },
});

/**
 * Catalogue cards carry a neighborhood color signature so each member reads at
 * a glance from the shared palette. Unknown neighborhoods fall back to the
 * neutral catalogue look.
 */
const catalogueTones: Record<string, { rule: string; label: string; index: string; wash: string }> = {
  "Long Island City": { rule: "border-lic", label: "text-lic", index: "text-lic", wash: "bg-lic" },
  Astoria: { rule: "border-astoria", label: "text-astoria", index: "text-astoria", wash: "bg-astoria" },
  Sunnyside: { rule: "border-sunnyside", label: "text-sunnyside", index: "text-sunnyside", wash: "bg-sunnyside" },
  "Jackson Heights": { rule: "border-jackson-heights", label: "text-jackson-heights", index: "text-jackson-heights", wash: "bg-jackson-heights" },
  "Forest Hills": { rule: "border-forest-hills", label: "text-forest-hills", index: "text-forest-hills", wash: "bg-forest-hills" },
  Elmhurst: { rule: "border-elmhurst", label: "text-elmhurst", index: "text-elmhurst", wash: "bg-elmhurst" },
  "Rego Park": { rule: "border-rego-park", label: "text-rego-park", index: "text-rego-park", wash: "bg-rego-park" },
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
        <div className={cn("grid h-52 grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-line p-4 sm:p-5", tone?.rule)}>
          <div className="grid min-w-0 grid-rows-[auto_1fr_auto]">
            <div>
              <p className="text-xs text-ink-muted">The Women’s Collective</p>
              <p className="mt-0.5 text-xs text-ink-muted">Member catalogue</p>
            </div>
            <h3 className="min-w-0 self-end font-display text-xl leading-tight sm:text-2xl">{member.name}</h3>
            <p className="mt-2 min-w-0 text-xs leading-relaxed text-ink-muted">{member.role}</p>
          </div>
          <div className="grid shrink-0 grid-rows-[auto_1fr_auto] justify-items-end text-xs text-ink-muted">
            <span aria-label={`Catalogue number ${catalogueNumber ?? 1}`} className={tone?.index}>{String(catalogueNumber ?? 1).padStart(2, "0")}</span>
            <span className={cn("max-w-24 text-right leading-relaxed", tone?.label)}>{member.neighborhood}</span>
          </div>
        </div>
        <div className={cn("aspect-[4/5] overflow-hidden p-3 sm:p-4", tone?.wash ?? "bg-surface")}>
          <img
            src={member.image}
            alt={member.imageAlt}
            loading="lazy"
            width={768}
            height={1024}
            className="size-full object-cover grayscale transition-[filter,transform] duration-slow ease-gentle group-hover:scale-[1.025] group-hover:grayscale-0 motion-reduce:transform-none motion-reduce:transition-none"
          />
        </div>
        <div className="flex min-h-24 flex-col justify-between gap-3 border-t border-line p-4 text-xs text-ink-muted sm:p-5">
          <p className="leading-relaxed text-ink">{member.business}</p>
          <p className="leading-relaxed">{member.specialty}</p>
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