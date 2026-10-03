import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import { Badge, Heading, Text } from "./typography";

const containerVariants = cva("mx-auto w-full px-6 md:px-[4.5rem]", {
  variants: { width: { narrow: "max-w-3xl", default: "max-w-[80rem]" } },
  defaultVariants: { width: "default" },
});
export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof containerVariants> {}
export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(({ className, width, ...p }, ref) => (
  <div ref={ref} className={cn(containerVariants({ width }), className)} {...p} />
));
Container.displayName = "Container";

const sectionVariants = cva("relative py-24 md:py-32", {
  variants: {
    tone: {
      light: "bg-canvas text-ink",
      night: "tone-night",
      /** Black panel whose top edge rises in a soft dome out of the light section above. */
      dome: "tone-night rounded-dome pt-32 md:pt-40",
    },
  },
  defaultVariants: { tone: "light" },
});
export interface SectionProps extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof sectionVariants> {}
export const Section = React.forwardRef<HTMLElement, SectionProps>(({ className, tone, ...p }, ref) => (
  <section ref={ref} className={cn(sectionVariants({ tone }), className)} {...p} />
));
Section.displayName = "Section";

export interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  badge?: React.ReactNode;
  title: React.ReactNode;
  intro?: React.ReactNode;
  align?: "center" | "start";
  /** Use "solid" on night sections. */
  badgeVariant?: "soft" | "solid";
}
export const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ className, badge, title, intro, align = "center", badgeVariant = "soft", ...p }, ref) => (
    <div ref={ref} className={cn("flex max-w-3xl flex-col gap-7", align === "center" ? "mx-auto items-center text-center" : "items-start", className)} {...p}>
      {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
      <Heading>{title}</Heading>
      {intro && <Text className="max-w-lg">{intro}</Text>}
    </div>
  ),
);
SectionHeader.displayName = "SectionHeader";

export interface SplitProps extends React.HTMLAttributes<HTMLDivElement> {
  media: React.ReactNode;
  reverse?: boolean;
}
export const Split = React.forwardRef<HTMLDivElement, SplitProps>(({ className, media, reverse, children, ...p }, ref) => (
  <div ref={ref} className={cn("grid items-center gap-12 md:grid-cols-2 md:gap-20", className)} {...p}>
    <div className={cn("flex flex-col gap-6", reverse && "md:order-2")}>{children}</div>
    <div>{media}</div>
  </div>
));
Split.displayName = "Split";

const navVariants = cva("z-30 w-full", {
  variants: {
    variant: {
      overlay: "absolute inset-x-0 top-0 text-white",
      solid: "sticky top-0 border-b border-line bg-canvas/85 text-ink backdrop-blur",
    },
  },
  defaultVariants: { variant: "solid" },
});
export interface NavbarProps extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof navVariants> {
  brand: React.ReactNode;
  links?: { label: string; href: string }[];
  action?: React.ReactNode;
}
export const Navbar = React.forwardRef<HTMLElement, NavbarProps>(({ className, variant, brand, links = [], action, ...p }, ref) => (
  <header ref={ref} className={cn(navVariants({ variant }), className)} {...p}>
    <Container className="flex h-28 items-center justify-between gap-6">
      <div className="shrink-0">{brand}</div>
      <nav aria-label="Main" className="hidden gap-5 md:flex">
        {links.map((l) => (
          <a key={l.href + l.label} href={l.href} className="font-sans text-base opacity-95 transition-opacity hover:opacity-70 focus-visible:underline focus-visible:outline-none">
            {l.label}
          </a>
        ))}
      </nav>
      <div className="shrink-0">{action}</div>
    </Container>
  </header>
));
Navbar.displayName = "Navbar";

export interface FooterProps extends React.HTMLAttributes<HTMLElement> {
  brand?: React.ReactNode;
  statement?: React.ReactNode;
  contacts?: { label: string; value: string; href?: string }[];
  links?: { label: string; href: string }[];
  note?: React.ReactNode;
}
export const Footer = React.forwardRef<HTMLElement, FooterProps>(
  ({ className, brand, statement, contacts = [], links = [], note, children, ...p }, ref) => (
    <footer ref={ref} className={cn("tone-night pt-24 pb-10", className)} {...p}>
      <Container className="flex flex-col gap-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-6">
            {brand}
            {statement && <Heading size="section" className="max-w-2xl">{statement}</Heading>}
            {children}
          </div>
          <dl className="flex flex-col gap-6 md:items-end md:text-right">
            {contacts.map((c) => (
              <div key={c.label}>
                <dt className="text-sm text-ink-muted">{c.label}</dt>
                <dd className="font-display text-2xl">{c.href ? <a href={c.href} className="hover:text-sky">{c.value}</a> : c.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-col justify-between gap-4 border-t border-line pt-8 text-sm text-ink-muted md:flex-row">
          <span>{note}</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-6">
            {links.map((l) => <a key={l.label} href={l.href} className="hover:text-ink">{l.label}</a>)}
          </nav>
        </div>
      </Container>
    </footer>
  ),
);
Footer.displayName = "Footer";
