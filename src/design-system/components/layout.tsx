import * as React from "react";
import { createPortal } from "react-dom";
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
  <section ref={ref} className={cn(sectionVariants({ tone }), "motion-section", className)} {...p} />
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
    <div ref={ref} className={cn("motion-stagger flex max-w-3xl flex-col gap-7", align === "center" ? "mx-auto items-center text-center" : "items-start", className)} {...p}>
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

/* Scroll chrome: a pinned bar lifts away on scroll down and returns on scroll up. */
const NAV_EDGE = 8;
const NAV_TOP = 120;
function useScrollChrome() {
  const [chrome, setChrome] = React.useState({ hidden: false, scrolled: false });
  const last = React.useRef(0);
  React.useEffect(() => {
    last.current = window.scrollY;
    setChrome({ hidden: false, scrolled: window.scrollY > 24 });
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const delta = y - last.current;
        if (Math.abs(delta) < NAV_EDGE) return;
        last.current = y;
        const next = { hidden: y > NAV_TOP && delta > 0, scrolled: y > 24 };
        setChrome((prev) => (prev.hidden === next.hidden && prev.scrolled === next.scrolled ? prev : next));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return chrome;
}

const navVariants = cva(
  "z-30 w-full transition-[transform,background-color,color,border-color,backdrop-filter] duration-base ease-gentle motion-reduce:transition-none",
  {
    variants: {
      variant: {
        overlay: "absolute inset-x-0 top-0 text-white",
        solid: "sticky top-0 border-b border-line bg-canvas/85 text-ink backdrop-blur",
        /** Transparent over hero photography, then black glass once the page moves. */
        hero: "sticky top-0 -mb-28 z-40 text-white",
      },
    },
    defaultVariants: { variant: "solid" },
  },
);
export interface NavbarProps extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof navVariants> {
  brand: React.ReactNode;
  links?: { label: string; href: string }[];
  action?: React.ReactNode;
  /** Shown at the foot of the mobile menu instead of `action`, e.g. a full-width join button. */
  menuAction?: React.ReactNode;
  /** Lift the bar out of view while scrolling down, return it on scroll up. */
  hideOnScroll?: boolean;
}

/* Below md the links move into a full-screen menu: Escape or the close button shuts it and focus returns to the menu button. */
function useMobileMenu() {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const id = React.useId();
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => setMounted(true), []);
  const close = React.useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);
  React.useEffect(() => {
    if (!open) return;
    const focusables = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    focusables()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 48rem)");
    const onDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onDesktop);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onDesktop);
    };
  }, [open, close]);
  return { open, setOpen, close, mounted, id, buttonRef, panelRef };
}

const menuIconButton = "grid size-11 shrink-0 place-items-center rounded-full border border-current/30 transition-[background-color,border-color] duration-300 hover:bg-current/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas md:hidden";

export const Navbar = React.forwardRef<HTMLElement, NavbarProps>(({ className, variant = "solid", brand, links = [], action, menuAction, hideOnScroll = true, ...p }, ref) => {
  const pinned = variant === "solid" || variant === "hero";
  const chrome = useScrollChrome();
  const menu = useMobileMenu();
  const [focused, setFocused] = React.useState(false);
  const hidden = hideOnScroll && pinned && chrome.hidden && !focused && !menu.open;
  return (
    <>
    <header
      ref={ref}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      className={cn(
        navVariants({ variant }),
        variant === "hero" && (chrome.scrolled ? "border-b border-white/10 bg-ink/90 text-white backdrop-blur" : "border-b border-transparent"),
        hidden && "-translate-y-full",
        className,
      )}
      {...p}
    >
      <Container className="flex h-28 items-center justify-between gap-3 md:gap-6">
        <div className="shrink-0">{brand}</div>
        <nav aria-label="Main" className="hidden gap-5 md:flex">
          {links.map((l) => (
            <a key={l.href + l.label} href={l.href} className="inline-flex min-h-11 items-center font-sans text-base opacity-95 transition-[transform,opacity] duration-300 hover:-translate-y-0.5 hover:opacity-70 focus-visible:underline focus-visible:outline-none motion-reduce:transform-none">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {links.length > 0 && (
            <button ref={menu.buttonRef} type="button" className={menuIconButton} aria-label="Open menu" aria-expanded={menu.open} aria-controls={menu.id} onClick={() => menu.setOpen(true)}>
              <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 8h16M4 16h16" /></svg>
            </button>
          )}
        </div>
      </Container>
    </header>
    {menu.mounted && links.length > 0 && createPortal(
      <div id={menu.id} ref={menu.panelRef} role="dialog" aria-modal="true" aria-label="Menu" hidden={!menu.open} className="tone-night fixed inset-0 z-[60] flex flex-col overflow-y-auto motion-panel-in md:hidden">
        <Container className="flex h-28 shrink-0 items-center justify-between gap-3">
          <span className="font-display text-2xl">Menu</span>
          <button type="button" className={menuIconButton} aria-label="Close menu" onClick={menu.close}>
            <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </Container>
        <Container className="flex flex-1 flex-col gap-10 pb-10">
          <nav aria-label="Main">
            <ul className="flex flex-col border-t border-line">
              {links.map((l) => (
                <li key={l.href + l.label}>
                  <a href={l.href} onClick={() => menu.setOpen(false)} className="flex min-h-16 items-center border-b border-line font-display text-3xl focus-visible:text-sky focus-visible:outline-none">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          {(menuAction ?? action) && <div className="flex flex-col gap-3">{menuAction ?? action}</div>}
        </Container>
      </div>,
      document.body,
    )}
    </>
  );
});
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
    <footer ref={ref} className={cn("tone-night motion-section pt-24 pb-10", className)} {...p}>
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
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6">
            {links.map((l) => <a key={l.label} href={l.href} className="inline-flex min-h-11 items-center hover:text-ink md:min-h-6">{l.label}</a>)}
          </nav>
        </div>
      </Container>
    </footer>
  ),
);
Footer.displayName = "Footer";
