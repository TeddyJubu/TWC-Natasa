import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

export interface EyebrowProps extends React.HTMLAttributes<HTMLParagraphElement> {}
export const Eyebrow = React.forwardRef<HTMLParagraphElement, EyebrowProps>(({ className, ...p }, ref) => (
  <p ref={ref} className={cn("font-sans text-xs uppercase tracking-[var(--tracking-eyebrow)] text-accent", className)} {...p} />
));
Eyebrow.displayName = "Eyebrow";

const headingVariants = cva("font-display text-ink text-balance [&_em]:italic [&_em]:text-accent", {
  variants: {
    size: {
      display: "text-5xl md:text-7xl leading-[1.02] font-light",
      section: "text-4xl md:text-5xl leading-[1.08] font-light",
      title: "text-2xl md:text-3xl leading-tight font-normal",
    },
  },
  defaultVariants: { size: "section" },
});
export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  as?: "h1" | "h2" | "h3" | "h4";
}
export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, size, as: Tag = "h2", ...p }, ref) => (
    <Tag ref={ref} className={cn(headingVariants({ size }), className)} {...p} />
  ),
);
Heading.displayName = "Heading";

const textVariants = cva("font-sans text-pretty", {
  variants: {
    tone: { default: "text-ink", muted: "text-ink-muted" },
    size: { sm: "text-sm leading-relaxed", md: "text-base leading-relaxed", lg: "text-lg leading-relaxed" },
  },
  defaultVariants: { tone: "muted", size: "md" },
});
export interface TextProps extends React.HTMLAttributes<HTMLParagraphElement>, VariantProps<typeof textVariants> {}
export const Text = React.forwardRef<HTMLParagraphElement, TextProps>(({ className, tone, size, ...p }, ref) => (
  <p ref={ref} className={cn(textVariants({ tone, size }), className)} {...p} />
));
Text.displayName = "Text";

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  ornament?: boolean;
}
export const Divider = React.forwardRef<HTMLDivElement, DividerProps>(({ className, ornament = true, ...p }, ref) => (
  <div ref={ref} role="separator" className={cn("flex items-center gap-4 text-accent", className)} {...p}>
    <span className="h-px flex-1 bg-line" />
    {ornament && <span aria-hidden className="font-display text-xl leading-none">❦</span>}
    <span className="h-px flex-1 bg-line" />
  </div>
));
Divider.displayName = "Divider";

const monogramVariants = cva("inline-flex items-center justify-center font-display italic text-ink", {
  variants: {
    size: { sm: "text-2xl", md: "text-4xl", lg: "size-32 rounded-full border border-line text-5xl" },
  },
  defaultVariants: { size: "sm" },
});
export interface MonogramProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof monogramVariants> {}
export const Monogram = React.forwardRef<HTMLSpanElement, MonogramProps>(({ className, size, ...p }, ref) => (
  <span ref={ref} className={cn(monogramVariants({ size }), className)} {...p} />
));
Monogram.displayName = "Monogram";
