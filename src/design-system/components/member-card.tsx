import * as React from "react";
import { CurvedLoop } from "./curved-loop";
import { BorderGlow } from "./border-glow";
import { ConstellationLogo } from "./brand";
import { ProximityText } from "./proximity-text";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, formatCatalogueNumber } from "../lib/utils";
import { Badge } from "./typography";

const cardVariants = cva("group border border-line bg-canvas text-ink transition-[transform,box-shadow] duration-base ease-gentle hover:-translate-y-1 hover:shadow-soft motion-reduce:transform-none motion-reduce:transition-none", {
  variants: {
    variant: {
      grid: "rounded-card overflow-hidden",
      featured: "grid rounded-panel overflow-hidden md:grid-cols-[1.05fr_1fr]",
      catalogue: "tone-night rounded-panel bg-canvas text-ink hover:-translate-y-1.5",
    },
  },
  defaultVariants: { variant: "grid" },
});

export interface MemberProfile {
  id: string;
  name: string;
  role: string;
  business: string;
  /** Empty when the member hasn't chosen one; the card then shows no neighborhood. */
  neighborhood: string;
  specialty: string;
  bio: string;
  lookingFor: string;
  image: string;
  imageAlt: string;
  catalogueNumber?: number;
  website?: string;
}

/** Color signature for a catalogue card, supplied by the caller (e.g. from neighborhood data). */
export interface MemberCardTone {
  color: string;
  // ponytail: logoSrc is accepted for the specified tone shape and not rendered yet.
  logoSrc?: string;
}

export interface MemberCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "children">, VariantProps<typeof cardVariants> {
  member: MemberProfile;
  catalogueNumber?: number;
  tone?: MemberCardTone;
}

/**
 * Use MemberCard for a public directory or a curated member preview.
 * @example <MemberCard member={member} />
 * @example <MemberCard member={member} variant="featured" />
 * @example <MemberCard member={member} variant="catalogue" catalogueNumber={1} tone={{ color: "#2f9dff" }} />
 * Catalogue cards take their color signature from `tone`, exposed as the `--hood`
 * custom property; without a tone they keep the neutral catalogue look.
 * Avoid placing MemberCard inside another card or supplying unapproved personal details.
 */
export const MemberCard = React.forwardRef<HTMLElement, MemberCardProps>(({ catalogueNumber, className, member, style, tone: toneProp, variant, ...props }, ref) => {
  const tone = variant === "catalogue" ? toneProp : undefined;
  const number = catalogueNumber ?? member.catalogueNumber ?? 1;
  const hoodStyle = tone ? ({ ...style, "--hood": tone.color } as React.CSSProperties) : style;
  return (
  <article ref={ref} className={cn(cardVariants({ variant }), className)} style={hoodStyle} {...props}>
    {variant === "catalogue" ? (
      <>
        <BorderGlow key={tone?.color ?? "neutral"} className="rounded-panel" glowVar={tone ? "--hood" : "--color-sky"} glowRadius={28} fillOpacity={0.25}>
          <div className={cn("relative flex min-h-[20rem] flex-col overflow-hidden border-b border-line p-6 sm:min-h-[23rem] sm:p-8 xl:min-h-[18rem] xl:p-5", tone && "border-(--hood)")}>
            <span
              aria-label={`Catalogue number ${number}`}
              className={cn(
                "absolute -left-6 -top-6 z-20 grid size-24 place-items-end justify-items-end rounded-full p-5 sm:-left-7 sm:-top-7 sm:size-28 sm:p-6 xl:-left-6 xl:-top-6 xl:size-24 xl:p-5",
                tone ? "bg-(--hood)" : "bg-surface",
              )}
            >
              <span className={cn("font-display text-2xl leading-none tabular-nums sm:text-3xl xl:text-2xl", tone ? "text-canvas" : "text-ink")}>
                {formatCatalogueNumber(number)}
              </span>
            </span>
            {/* Decorative: the loop's sr-only text and the logo alt would repeat on every card. */}
            <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 z-30 size-36 text-ink-muted sm:-right-9 sm:-top-9 sm:size-40 xl:-right-8 xl:-top-8 xl:size-36">
              <CurvedLoop
                marqueeText="The Women’s Collective ✦ Member catalogue"
                className="size-full [&_svg]:size-full [&_svg]:text-[0.72rem] sm:[&_svg]:text-[0.76rem]"
                speed={0.22}
                path="M72,8 A64,64 0 1,1 71.9,8"
                viewBox="0 0 144 144"
              />
              <ConstellationLogo
                variant="white"
                alt="The Women’s Collective"
                className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2"
              />
            </div>

          <div className="relative z-20 mt-auto flex items-end justify-between gap-5">
            <div className="min-w-0">
              <h3 className="max-w-[10ch] text-balance font-display text-5xl font-normal leading-[0.96] sm:text-6xl lg:text-7xl xl:text-5xl">
                <ProximityText text={member.name} />
              </h3>
              <div className="mt-5 flex items-center gap-4 text-sm text-ink-muted sm:text-base xl:mt-4 xl:text-sm">
                <p className="min-w-0 leading-snug">{member.role}</p>
              </div>
            </div>
            {member.neighborhood && (
              <p
                className={cn(
                  "flex shrink-0 items-start gap-3 [writing-mode:vertical-rl] [transform:rotate(180deg)]",
                  tone && "text-(--hood)",
                )}
              >
                <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                  <circle cx="12" cy="10" r="2.25" />
                </svg>
                <span className="leading-none">{member.neighborhood}</span>
              </p>
            )}
          </div>
          </div>

        <div className={cn("p-3 sm:p-4 xl:p-3", tone ? "bg-(--hood)" : "bg-surface")}>
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

        <div className="grid min-h-32 grid-cols-[minmax(0,1fr)_auto] items-center gap-6 overflow-hidden rounded-b-[31px] border-t border-line p-6 sm:p-8 xl:min-h-28 xl:gap-3 xl:p-5">
          <div className="min-w-0">
            <span aria-hidden className={cn("mb-4 block h-0.5 w-7 xl:mb-3", tone ? "bg-(--hood)" : "bg-surface-strong")} />
            <p className="font-display text-2xl font-normal leading-tight text-ink sm:text-3xl xl:text-xl">{member.business}</p>
            <p className="mt-2 text-xs uppercase leading-relaxed text-ink-muted">{member.specialty}</p>
          </div>
          <span aria-hidden className={cn("grid size-14 shrink-0 place-items-center rounded-full border text-2xl transition-transform duration-base ease-gentle group-hover:translate-x-1 motion-reduce:transform-none xl:size-11 xl:text-xl", tone && "border-(--hood) text-(--hood)")}>→</span>
        </div>
        </BorderGlow>
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
      {member.neighborhood && <Badge variant="glass" className="absolute bottom-5 left-5 text-white">{member.neighborhood}</Badge>}
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
