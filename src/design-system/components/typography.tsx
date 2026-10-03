import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

/** Small blossom mark used inside badges and ribbons. */
export interface BlossomProps extends React.SVGAttributes<SVGSVGElement> {}
export const Blossom = React.forwardRef<SVGSVGElement, BlossomProps>(({ className, ...p }, ref) => (
  <svg ref={ref} viewBox="0 0 16 16" aria-hidden className={cn("size-4 shrink-0", className)} fill="currentColor" {...p}>
    <circle cx="8" cy="4.2" r="3.2" />
    <circle cx="4.2" cy="9.2" r="3.2" />
    <circle cx="11.8" cy="9.2" r="3.2" />
    <circle cx="8" cy="8.4" r="1.6" fill="var(--bl-canvas)" />
  </svg>
));
Blossom.displayName = "Blossom";

const badgeVariants = cva(
  "inline-flex h-12 items-center gap-3 rounded-full px-6 font-sans text-[0.95rem] leading-none",
  {
    variants: {
      variant: {
        soft: "bg-surface text-ink",
        glass: "border border-glass-line bg-glass text-white backdrop-blur-md",
        solid: "bg-white text-black",
      },
    },
    defaultVariants: { variant: "soft" },
  },
);
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  icon?: boolean;
}
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant, icon = true, children, ...p }, ref) => (
  <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...p}>
    {icon && <Blossom />}
    {children}
  </span>
));
Badge.displayName = "Badge";

const headingVariants = cva("font-display font-normal text-ink text-balance tracking-[-0.01em]", {
  variants: {
    size: {
      display: "text-6xl leading-[1.05] md:text-[6rem]",
      section: "text-4xl leading-[1.12] md:text-6xl",
      title: "text-2xl leading-tight md:text-3xl",
    },
  },
  defaultVariants: { size: "section" },
});
export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement>, VariantProps<typeof headingVariants> {
  as?: "h1" | "h2" | "h3" | "h4";
}
export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(({ className, size, as: Tag = "h2", ...p }, ref) => (
  <Tag ref={ref} className={cn(headingVariants({ size }), className)} {...p} />
));
Heading.displayName = "Heading";

const textVariants = cva("font-sans text-pretty", {
  variants: {
    tone: { default: "text-ink", muted: "text-ink-muted" },
    size: { sm: "text-sm leading-relaxed", md: "text-base leading-relaxed", lg: "text-lg leading-relaxed" },
  },
  defaultVariants: { tone: "default", size: "md" },
});
export interface TextProps extends React.HTMLAttributes<HTMLParagraphElement>, VariantProps<typeof textVariants> {}
export const Text = React.forwardRef<HTMLParagraphElement, TextProps>(({ className, tone, size, ...p }, ref) => (
  <p ref={ref} className={cn(textVariants({ tone, size }), className)} {...p} />
));
Text.displayName = "Text";

/** Large serif statement: the first `lead` words in ink, the rest fade to faint. */
export interface StatementProps extends React.HTMLAttributes<HTMLParagraphElement> {
  text: string;
  lead?: number;
}
export const Statement = React.forwardRef<HTMLParagraphElement, StatementProps>(({ className, text, lead = 1, ...p }, ref) => {
  const words = text.split(" ");
  return (
    <p ref={ref} className={cn("font-display text-3xl leading-[1.3] text-ink-faint md:text-[2.75rem] text-balance", className)} {...p}>
      <span className="text-ink">{words.slice(0, lead).join(" ")}</span> {words.slice(lead).join(" ")}
    </p>
  );
});
Statement.displayName = "Statement";

/** Oversized serif number with an optional label. */
export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  label?: string;
}
export const Stat = React.forwardRef<HTMLDivElement, StatProps>(({ className, value, label, ...p }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-2", className)} {...p}>
    <span className="font-display text-7xl leading-none text-ink tabular-nums">{value}</span>
    {label && <span className="font-sans text-sm text-ink-muted">{label}</span>}
  </div>
));
Stat.displayName = "Stat";

/** Serif wordmark, e.g. "W&R". */
export interface WordmarkProps extends React.HTMLAttributes<HTMLSpanElement> {}
export const Wordmark = React.forwardRef<HTMLSpanElement, WordmarkProps>(({ className, ...p }, ref) => (
  <span ref={ref} className={cn("font-display text-3xl leading-none tracking-tight", className)} {...p} />
));
Wordmark.displayName = "Wordmark";
