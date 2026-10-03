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
  "Long Island City": { rule: "border-lic/30", label: "text-lic", index: "text-lic", wash: "bg-lic/20" },
  Astoria: { rule: "border-astoria/30", label: "text-astoria", index: "text-astoria", wash: "bg-astoria/20" },
  Sunnyside: { rule: "border-sunnyside/30", label: "text-sunnyside", index: "text-sunnyside", wash: "bg-sunnyside/20" },
  "Jackson Heights": { rule: "border-jackson-heights/30", label: "text-jackson-heights", index: "text-jackson-heights", wash: "bg-jackson-heights/20" },
  "Forest Hills": { rule: "border-forest-hills/30", label: "text-forest-hills", index: "text-forest-hills", wash: "bg-forest-hills/20" },
  Elmhurst: { rule: "border-elmhurst/30", label: "text-elmhurst", index: "text-elmhurst", wash: "bg-elmhurst/20" },
  "Rego Park": { rule: "border-rego-park/30", label: "text-rego-park", index: "text-rego-park", wash: "bg-rego-park/20" },
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
 * Avoid placing MemberCard inside another card or supplying unapproved personal details.
 */
export const MemberCard = React.forwardRef<HTMLElement, MemberCardProps>(({ catalogueNumber, className, member, variant, ...props }, ref) => (
  <article ref={ref} className={cn(cardVariants({ variant }), className)} {...props}>
    {variant === "catalogue" ? (
      <>
        <div className="grid min-h-40 grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-line p-4 sm:p-5">
          <div className="flex min-w-0 flex-col justify-between gap-5">
            <div>
              <p className="text-xs text-ink-muted">The Women’s Collective</p>
              <p className="mt-0.5 text-xs text-ink-muted">Member catalogue</p>
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-xl leading-tight sm:text-2xl">{member.name}</h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">{member.role}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end justify-between text-xs text-ink-muted">
            <span aria-label={`Catalogue number ${catalogueNumber ?? 1}`}>{String(catalogueNumber ?? 1).padStart(2, "0")}</span>
            <span className="max-w-24 text-right leading-relaxed">{member.neighborhood}</span>
          </div>
        </div>
        <div className="aspect-[4/5] overflow-hidden bg-surface p-3 sm:p-4">
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
));
MemberCard.displayName = "MemberCard";