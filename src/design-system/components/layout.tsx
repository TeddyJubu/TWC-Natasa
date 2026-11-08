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
  /** "h1" when the header opens the page (no Hero above it). */
  headingAs?: "h1" | "h2";
}
export const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ className, badge, title, intro, align = "center", badgeVariant = "soft", headingAs = "h2", ...p }, ref) => (
    <div ref={ref} className={cn("motion-stagger flex max-w-3xl flex-col gap-7", align === "center" ? "mx-auto items-center text-center" : "items-start", className)} {...p}>
      {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
      <Heading as={headingAs}>{title}</Heading>
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

/**
 * A router-aware link: receives in-app paths ("/members", "/#mission") from `Navbar` and `Footer`.
 * Hash-only, mailto:, protocol-relative and external hrefs always render as a plain `<a>`.
 */
export type RouterLinkComponent = React.ComponentType<{
  href: string;
  className?: string;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}>;

const isInternalHref = (href: string) => href.startsWith("/") && !href.startsWith("//");

function ChromeLink({ href, linkComponent: RouterLink, className, onClick, children }: {
  href: string;
  linkComponent?: RouterLinkComponent;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  children: React.ReactNode;
}) {
  if (RouterLink && isInternalHref(href)) return <RouterLink href={href} className={className} onClick={onClick}>{children}</RouterLink>;
  return <a href={href} className={className} onClick={onClick}>{children}</a>;
}

/** Locks body scroll while `locked`, restoring whatever `overflow` was there before (also on unmount). */
function useBodyScrollLock(locked: boolean) {
  React.useEffect(() => {
    if (!locked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
}

/**
 * While `active`, marks every sibling of `el` and of each ancestor up to `<body>` inert, so only `el` stays
 * reachable. Undoes only what it set: elements that were already inert stay inert.
 */
function useInertBackground(el: React.RefObject<HTMLElement | null>, active: boolean) {
  React.useEffect(() => {
    const node = el.current;
    if (!active || !node) return;
    const marked: Element[] = [];
    for (let current: Element = node; current !== document.body && current.parentElement; current = current.parentElement) {
      for (const sibling of current.parentElement.children) {
        if (sibling === current || sibling.hasAttribute("inert")) continue;
        sibling.setAttribute("inert", "");
        marked.push(sibling);
      }
    }
    return () => marked.forEach((sibling) => sibling.removeAttribute("inert"));
  }, [el, active]);
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
  /** Lift the bar out of view while scrolling down, return it on scroll up. */
  hideOnScroll?: boolean;
  /** Renders in-app hrefs (starting with "/") through the host router; everything else stays a plain `<a>`. */
  linkComponent?: RouterLinkComponent;
}
const navLinkClass =
  "font-sans text-base opacity-95 transition-[transform,opacity] duration-300 hover:-translate-y-0.5 hover:opacity-70 focus-visible:underline focus-visible:outline-none motion-reduce:transform-none";
export const Navbar = React.forwardRef<HTMLElement, NavbarProps>(({ className, variant = "solid", brand, links = [], action, hideOnScroll = true, linkComponent, ...p }, ref) => {
  const pinned = variant === "solid" || variant === "hero";
  const chrome = useScrollChrome();
  const [focused, setFocused] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const panelId = React.useId();
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const headerRef = React.useRef<HTMLElement | null>(null);
  const setHeaderRef = React.useCallback((node: HTMLElement | null) => {
    headerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, [ref]);
  const hidden = hideOnScroll && pinned && chrome.hidden && !focused && !menuOpen;
  useBodyScrollLock(menuOpen);
  useInertBackground(headerRef, menuOpen);

  React.useEffect(() => {
    if (!menuOpen) return;
    panelRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return; // another widget already handled this Escape
      setMenuOpen(false);
      buttonRef.current?.focus();
    };
    // Back/forward and hash jumps navigate without a click in the bar.
    const close = () => setMenuOpen(false);
    // A tap on the (inert) page behind the panel dismisses it.
    const onPointerDown = (e: PointerEvent) => {
      if (headerRef.current?.contains(e.target as Node)) return;
      const hadFocus = panelRef.current?.contains(document.activeElement);
      setMenuOpen(false);
      if (hadFocus) buttonRef.current?.focus({ preventScroll: true });
    };
    // The panel is mobile-only: widening past md closes it so the scroll lock never outlives it.
    const wide = typeof window.matchMedia === "function" ? window.matchMedia("(min-width: 48rem)") : null;
    const onWide = (e: MediaQueryListEvent) => e.matches && setMenuOpen(false);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("popstate", close);
    window.addEventListener("hashchange", close);
    wide?.addEventListener?.("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("popstate", close);
      window.removeEventListener("hashchange", close);
      wide?.removeEventListener?.("change", onWide);
    };
  }, [menuOpen]);

  return (
    <header
      ref={setHeaderRef}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      onClickCapture={(e) => {
        // Any link in the bar (panel, brand, action) navigates: close the menu. A panel link unmounts
        // focus without a blur, so clear the flag too, or hide-on-scroll would stay off.
        if (!menuOpen || !(e.target as Element).closest("a[href]")) return;
        // The panel is about to hide with focus inside it: park focus on the toggle rather than <body>.
        // A real navigation then hands focus to the page (useRouteFocus in the app). Focus first: its
        // onFocusCapture sets the flag, and the setFocused(false) after it must win.
        if (panelRef.current?.contains(e.target as Node)) buttonRef.current?.focus({ preventScroll: true });
        setFocused(false);
        setMenuOpen(false);
      }}
      className={cn(
        navVariants({ variant }),
        variant === "hero" && (chrome.scrolled || menuOpen ? "border-b border-white/10 bg-ink/90 text-white backdrop-blur" : "border-b border-transparent"),
        hidden && "-translate-y-full",
        className,
      )}
      {...p}
    >
      <Container className="flex h-28 items-center justify-between gap-6">
        <div className="shrink-0">{brand}</div>
        <nav aria-label="Main" className="hidden gap-5 md:flex">
          {links.map((l) => (
            <ChromeLink key={l.href + l.label} href={l.href} linkComponent={linkComponent} className={navLinkClass}>
              {l.label}
            </ChromeLink>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-3">
          {action}
          {links.length > 0 && (
            <button
              ref={buttonRef}
              type="button"
              aria-label="Menu"
              aria-expanded={menuOpen}
              aria-controls={panelId}
              onClick={() => setMenuOpen((open) => !open)}
              className={cn("inline-flex size-11 items-center justify-center rounded-full border transition-[background-color,opacity] duration-fast ease-gentle hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current motion-reduce:transition-none md:hidden",
                // 3:1 border: ink at 55% on the light bar; full white over hero sky and photos.
                variant === "solid" ? "border-current/55" : "border-current",
              )}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 8h16M4 16h16" />}
              </svg>
            </button>
          )}
        </div>
      </Container>
      {/* Always mounted (hidden when closed) so aria-controls points at a real element. */}
      <div
        id={panelId}
        ref={panelRef}
        hidden={!menuOpen}
        className={cn(
          "absolute inset-x-0 top-full max-h-[calc(100dvh-7rem)] overflow-y-auto border-y shadow-soft motion-panel-in motion-reduce:animate-none md:hidden",
          variant === "solid" ? "border-line bg-canvas text-ink" : "tone-night border-white/10",
        )}
      >
        <Container>
          {/* Named "Main" like the desktop nav, which is display:none whenever this panel shows. */}
          <nav aria-label="Main" className="flex flex-col py-4">
            {links.map((l) => (
              <ChromeLink
                key={l.href + l.label}
                href={l.href}
                linkComponent={linkComponent}
                className="border-b border-line py-4 font-display text-2xl last:border-b-0 transition-opacity duration-fast hover:opacity-70 focus-visible:underline focus-visible:outline-none"
              >
                {l.label}
              </ChromeLink>
            ))}
          </nav>
        </Container>
      </div>
    </header>
  );
});
Navbar.displayName = "Navbar";

export interface FooterProps extends React.HTMLAttributes<HTMLElement> {
  brand?: React.ReactNode;
  statement?: React.ReactNode;
  contacts?: { label: string; value: string; href?: string }[];
  links?: { label: string; href: string }[];
  note?: React.ReactNode;
  /** Renders in-app hrefs (starting with "/") through the host router; everything else stays a plain `<a>`. */
  linkComponent?: RouterLinkComponent;
}
export const Footer = React.forwardRef<HTMLElement, FooterProps>(
  ({ className, brand, statement, contacts = [], links = [], note, linkComponent, children, ...p }, ref) => (
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
                <dd className="font-display text-2xl">{c.href ? <ChromeLink href={c.href} linkComponent={linkComponent} className="hover:text-sky">{c.value}</ChromeLink> : c.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-col justify-between gap-4 border-t border-line pt-8 text-sm text-ink-muted md:flex-row">
          <span>{note}</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-6">
            {links.map((l) => <ChromeLink key={l.label} href={l.href} linkComponent={linkComponent} className="hover:text-ink">{l.label}</ChromeLink>)}
          </nav>
        </div>
      </Container>
    </footer>
  ),
);
Footer.displayName = "Footer";
