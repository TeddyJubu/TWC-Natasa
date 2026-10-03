import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import { Eyebrow, Heading, Text } from "./typography";

const containerVariants = cva("mx-auto w-full px-6 md:px-10", {
  variants: { width: { narrow: "max-w-3xl", default: "max-w-6xl", wide: "max-w-7xl" } },
  defaultVariants: { width: "default" },
});
export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof containerVariants> {}
export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(({ className, width, ...p }, ref) => (
  <div ref={ref} className={cn(containerVariants({ width }), className)} {...p} />
));
Container.displayName = "Container";

const sectionVariants = cva("py-20 md:py-28", {
  variants: { tone: { paper: "bg-paper", surface: "bg-surface" } },
  defaultVariants: { tone: "paper" },
});
export interface SectionProps extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof sectionVariants> {}
export const Section = React.forwardRef<HTMLElement, SectionProps>(({ className, tone, ...p }, ref) => (
  <section ref={ref} className={cn(sectionVariants({ tone }), className)} {...p} />
));
Section.displayName = "Section";

export interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  intro?: React.ReactNode;
  align?: "center" | "start";
}
export const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ className, eyebrow, title, intro, align = "center", ...p }, ref) => (
    <div
      ref={ref}
      className={cn("flex max-w-2xl flex-col gap-4", align === "center" ? "mx-auto items-center text-center" : "items-start", className)}
      {...p}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Heading>{title}</Heading>
      {intro && <Text size="lg">{intro}</Text>}
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
    <div className={cn(reverse && "md:order-2")}>{media}</div>
    <div className="flex flex-col gap-6">{children}</div>
  </div>
));
Split.displayName = "Split";

export interface NavbarProps extends React.HTMLAttributes<HTMLElement> {
  brand: React.ReactNode;
  links?: { label: string; href: string }[];
  action?: React.ReactNode;
}
export const Navbar = React.forwardRef<HTMLElement, NavbarProps>(({ className, brand, links = [], action, ...p }, ref) => (
  <header ref={ref} className={cn("sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur", className)} {...p}>
    <Container className="flex h-16 items-center justify-between gap-6">
      <div className="shrink-0">{brand}</div>
      <nav aria-label="Main" className="hidden gap-8 md:flex">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="font-sans text-sm text-ink-muted transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none">
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
  links?: { label: string; href: string }[];
  note?: React.ReactNode;
}
export const Footer = React.forwardRef<HTMLElement, FooterProps>(
  ({ className, brand, statement, links = [], note, children, ...p }, ref) => (
    <footer ref={ref} className={cn("border-t border-line bg-surface py-16", className)} {...p}>
      <Container className="flex flex-col items-center gap-8 text-center">
        {brand}
        {statement && <Heading size="title" className="max-w-xl">{statement}</Heading>}
        {children}
        <div className="flex w-full flex-col items-center justify-between gap-4 border-t border-line pt-8 text-sm text-ink-muted md:flex-row">
          <span>{note}</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-6">
            {links.map((l) => (
              <a key={l.label} href={l.href} className="hover:text-accent">{l.label}</a>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  ),
);
Footer.displayName = "Footer";
