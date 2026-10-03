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
    },
  },
  defaultVariants: { variant: "grid" },
});

export interface MemberCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "children">, VariantProps<typeof cardVariants> {
  member: MemberProfile;
}

/**
 * Use MemberCard for a public directory or a curated member preview.
 * @example <MemberCard member={member} />
 * @example <MemberCard member={member} variant="featured" />
 * Avoid placing MemberCard inside another card or supplying unapproved personal details.
 */
export const MemberCard = React.forwardRef<HTMLElement, MemberCardProps>(({ className, member, variant, ...props }, ref) => (
  <article ref={ref} className={cn(cardVariants({ variant }), className)} {...props}>
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
  </article>
));
MemberCard.displayName = "MemberCard";