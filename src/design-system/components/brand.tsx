import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import { CONSTELLATION_LOGO_SIZE, constellationLogoSources, constellationLogoSrcSets } from "../lib/logo-sources";

const logoVariants = cva("block h-auto object-contain", {
  variants: {
    size: {
      sm: "w-9",
      md: "w-16",
      lg: "w-28",
      display: "w-44 md:w-60",
    },
  },
  defaultVariants: { size: "md" },
});

/** Each size's drawn width, for `sizes`. A caller that sets its own width in `className` passes its own `sizes`. */
const logoSizes = { sm: "36px", md: "64px", lg: "112px", display: "(min-width: 48rem) 240px, 176px" } as const;

export interface ConstellationLogoProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">,
    VariantProps<typeof logoVariants> {
  variant?: keyof typeof constellationLogoSources;
  alt?: string;
}

export const ConstellationLogo = React.forwardRef<HTMLImageElement, ConstellationLogoProps>(
  ({ className, size, variant = "ink", alt = "The Women’s Collective constellation", sizes, ...props }, ref) => (
    <img
      ref={ref}
      src={constellationLogoSources[variant]}
      srcSet={constellationLogoSrcSets[variant]}
      sizes={sizes ?? logoSizes[size ?? "md"]}
      {...CONSTELLATION_LOGO_SIZE}
      alt={alt}
      className={cn(logoVariants({ size }), className)}
      {...props}
    />
  ),
);
ConstellationLogo.displayName = "ConstellationLogo";

export interface BrandLockupProps extends React.HTMLAttributes<HTMLDivElement> {
  logoVariant?: keyof typeof constellationLogoSources;
  compact?: boolean;
}

export const BrandLockup = React.forwardRef<HTMLDivElement, BrandLockupProps>(
  ({ className, logoVariant = "ink", compact = false, ...props }, ref) => (
    <div ref={ref} className={cn("inline-flex items-center gap-3", className)} {...props}>
      <ConstellationLogo variant={logoVariant} size={compact ? "sm" : "md"} />
      <span className={cn("font-display leading-[0.9]", compact ? "text-xl" : "text-2xl")}>
        The Women’s<br />Collective
      </span>
    </div>
  ),
);
BrandLockup.displayName = "BrandLockup";