// The internal pages' settings-app shell (/account, /admin): sidebar (a drawer below lg), top bar, and the page column.
// Public pages use AppNav/AppFooter instead. See DESIGN.md "Internal pages".
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ConstellationLogo, cn } from "@/index";
import { Icon, type IconName } from "./icons";
import { ring } from "./app-classes";
import { useSignOut } from "./sign-out";

/** The internal pages: each renders `AppShell` with its own path. */
export type ShellPage = "/account" | "/admin";
/** `sr` prefixes the accessible name where a label repeats in another group ("Admin Gatherings"). */
type NavItem = { label: string; icon: IconName; to: "/" | "/members" | ShellPage; hash?: string; sr?: string };
type NavGroup = { label: string; items: NavItem[]; fold?: boolean };

const COLLECTIVE: NavItem[] = [
  { label: "Home", icon: "house", to: "/" },
  { label: "Members", icon: "users", to: "/members" },
  { label: "Gatherings", icon: "calendar-days", to: "/account", hash: "gatherings" },
  { label: "Introductions", icon: "handshake", to: "/account", hash: "introductions" },
];
const MY_ACCOUNT: NavItem[] = [
  { label: "Profile", icon: "circle-user-round", to: "/account", hash: "profile" },
  { label: "Public card", icon: "id-card", to: "/account", hash: "public-card" },
  { label: "Visibility", icon: "eye", to: "/account", hash: "visibility" },
  { label: "Headshot session", icon: "camera", to: "/account", hash: "headshot" },
];
const ADMIN: NavItem[] = [
  { label: "Applications", icon: "notebook-pen", to: "/admin", hash: "applications" },
  { label: "All members", icon: "badge-check", to: "/admin", hash: "members" },
  { label: "Neighborhoods", icon: "map-pin", to: "/admin", hash: "neighborhoods" },
  { label: "Headshot bookings", icon: "calendar", to: "/admin", hash: "bookings" },
  { label: "Gatherings", icon: "calendar-days", to: "/admin", hash: "gatherings", sr: "Admin" },
];

/** The Admin group only for admins; UX only, since /admin's guard and every admin server function check again. */
const groups = (admin: boolean): NavGroup[] => [
  { label: "Collective", items: COLLECTIVE },
  { label: "My Account", items: MY_ACCOUNT, fold: true },
  ...(admin ? [{ label: "Admin", items: ADMIN, fold: true }] : []),
];

/**
 * This page's anchored card nearest the top of the viewport, or the one the URL hash names. One instance per page
 * (in AppShell), so opening the drawer never re-runs the arrival scroll.
 */
function useActiveSection(page: ShellPage) {
  // Page groups first, so the top card (Profile, Applications) is "here" before anything scrolls.
  const anchors = [...MY_ACCOUNT, ...ADMIN, ...COLLECTIVE].filter((i) => i.to === page && i.hash).map((i) => i.hash!);
  const key = anchors.join(" ");
  const [active, setActive] = React.useState(anchors[0]);
  React.useEffect(() => {
    const ids = key.split(" ");
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (ids.includes(id)) setActive(id);
    };
    fromHash();
    // Arriving at a card from the other internal page (or a fresh load): it rendered after the router's hash scroll,
    // and useRouteFocus leaves hash URLs alone, so scroll to it and, unless something already has focus, focus its heading.
    const hash = window.location.hash.slice(1);
    const target = ids.includes(hash) ? document.getElementById(hash) : null;
    if (target) {
      target.scrollIntoView?.();
      const heading = target.querySelector<HTMLElement>("h1, h2");
      if (heading && (document.activeElement === document.body || document.activeElement === null)) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    }
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    // A short last card never reaches the band, so scrolled to the end means the last card (in page order) is "here".
    const last = els.reduce<HTMLElement | undefined>((a, e) => (!a || a.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING ? e : a), undefined);
    const atEnd = () => !!last && window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    const onScroll = () => { if (atEnd()) setActive(last!.id); };
    window.addEventListener("hashchange", fromHash);
    window.addEventListener("scroll", onScroll, { passive: true });
    // A band across the upper third: whichever anchored card crosses it is "here".
    const observer = new IntersectionObserver(
      (entries) => {
        if (atEnd()) return setActive(last!.id);
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    for (const el of els) observer.observe(el);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [key]);
  return active;
}

/** Logo tile + name + domain, linking home. */
function Brand({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="The Women’s Collective home" className={cn("flex min-w-0 items-center gap-2.5 rounded-[10px] border border-app-line bg-app px-2.5 py-2 hover:bg-app-sunken", ring, className)}>
      {/* The logo artwork is white, so its tile is fixed black in both themes. */}
      <span className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-black"><ConstellationLogo variant="white" alt="" className="w-4.5" /></span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-sm font-medium text-ink">The Women’s Collective</span>
        <span className="truncate text-xs text-app-muted">thewomenscollective.club</span>
      </span>
    </Link>
  );
}

/** A card on this page is an in-page anchor (aria-current while it's in view); anything else is a router link. */
function NavLink({ item, page, active, onNavigate }: { item: NavItem; page: ShellPage; active: string; onNavigate?: () => void }) {
  const here = item.to === page && !!item.hash;
  const current = here && item.hash === active;
  const cls = cn(
    "flex w-full items-center gap-3.5 rounded-[10px] px-3 py-2.5 text-[15.5px] transition-colors",
    current ? "bg-app-line font-medium text-ink" : "text-ink hover:bg-app-line/50", ring,
  );
  const body = <><Icon name={item.icon} className={cn("size-4.75", current ? "text-ink" : "text-ink-muted")} />{item.sr && <span className="sr-only">{item.sr} </span>}{item.label}</>;
  return (
    <li>
      {here
        ? <a href={`#${item.hash}`} aria-current={current ? "location" : undefined} className={cls} onClick={onNavigate}>{body}</a>
        : <Link to={item.to} hash={item.hash} className={cls} onClick={onNavigate}>{body}</Link>}
    </li>
  );
}

/** Every nav group and Sign out; the same markup fills the sidebar and the drawer. */
function ShellNav({ page, admin, active, onSignOut, onNavigate }: {
  page: ShellPage; admin: boolean; active: string; onSignOut: () => void; onNavigate?: () => void;
}) {
  const list = (items: NavItem[]) => (
    <ul className="flex flex-col gap-0.5">
      {items.map((i) => <NavLink key={`${i.to}#${i.hash}`} item={i} page={page} active={active} onNavigate={onNavigate} />)}
    </ul>
  );
  return (
    <>
      <nav aria-label="Main" className="flex flex-col gap-7">
        {groups(admin).map((g) => g.fold ? (
          <details key={g.label} open className="group flex flex-col gap-0.5">
            <summary className={cn("flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md px-3 pb-2 text-sm text-app-muted [&::-webkit-details-marker]:hidden", ring)}>
              {g.label} <Icon name="chevron-down" className="size-3.25 -rotate-90 transition-transform group-open:rotate-0 motion-reduce:transition-none" />
            </summary>
            {list(g.items)}
          </details>
        ) : (
          <div key={g.label} className="flex flex-col gap-0.5">
            <p className="px-3 pb-2 text-sm text-app-muted">{g.label}</p>
            {list(g.items)}
          </div>
        ))}
      </nav>
      <button type="button" onClick={onSignOut} className={cn("mt-auto flex w-full items-center gap-3.5 rounded-[10px] px-3 py-2.5 text-[15.5px] text-ink-muted hover:bg-app-line/50", ring)}>
        <Icon name="log-out" className="size-4.75 text-app-muted" />Sign out
      </button>
    </>
  );
}

/** Below lg: the brand and a menu button opening the nav in a modal drawer (focus trapped, Escape closes). */
function MobileBar(props: { page: ShellPage; admin: boolean; active: string; onSignOut: () => void }) {
  const [open, setOpen] = React.useState(false);
  const dialog = React.useRef<HTMLDialogElement>(null);
  const button = React.useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  React.useLayoutEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) {
      d.close();
      button.current?.focus();
    }
  }, [open]);

  return (
    <div className="flex items-center justify-between gap-3 border-b border-app-line bg-app-sunken px-4 py-3 lg:hidden">
      <Brand />
      <button
        ref={button} type="button" aria-label="Open menu" aria-expanded={open} aria-controls="app-drawer" onClick={() => setOpen(true)}
        className={cn("grid size-10 shrink-0 place-items-center rounded-[9px] border border-app-line bg-app text-ink", ring)}
      >
        <Icon name="menu" className="size-5" />
      </button>
      <dialog
        ref={dialog} id="app-drawer" aria-label="Menu"
        onClose={close}
        onKeyDown={(e) => { if (e.key === "Escape") close(); }}
        onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        className="m-0 h-dvh max-h-none w-[min(20.75rem,85vw)] max-w-none bg-app-sunken p-0 text-ink backdrop:bg-black/40"
      >
        {open && (
          <div className="flex min-h-full flex-col gap-7 px-4 pt-4 pb-6">
            <div className="flex items-center gap-2">
              <Brand className="flex-1" />
              <button type="button" aria-label="Close menu" onClick={close} className={cn("grid size-10 shrink-0 place-items-center rounded-[9px] text-ink-muted hover:bg-app-line/50", ring)}>
                <Icon name="x" className="size-5" />
              </button>
            </div>
            <ShellNav {...props} onNavigate={close} />
          </div>
        )}
      </dialog>
    </div>
  );
}

/**
 * Sidebar + page column for an internal page. `children` is the page's one `<main id="main" tabIndex={-1}>`,
 * starting with its `TopBar`. Sign out lives here; a failed sign-out shows above the page.
 */
export function AppShell({ page, admin, children }: { page: ShellPage; admin: boolean; children: React.ReactNode }) {
  const { signOut, error } = useSignOut();
  const active = useActiveSection(page);
  return (
    <div className="min-h-screen bg-app text-ink lg:flex">
      <MobileBar page={page} admin={admin} active={active} onSignOut={signOut} />
      <aside className="sticky top-0 hidden h-dvh w-83 shrink-0 flex-col gap-7 overflow-y-auto border-r border-app-line bg-app-sunken px-4 pt-5.5 pb-6 lg:flex">
        <Brand />
        <ShellNav page={page} admin={admin} active={active} onSignOut={signOut} />
      </aside>
      <div className="min-w-0 flex-1">
        {error && <p role="alert" className="px-4 pt-4 text-sm text-danger sm:px-8">{error}</p>}
        {children}
      </div>
    </div>
  );
}

/**
 * The sticky bar atop the page column: "Section / icon Title" and the page's actions. `heading` makes the title
 * the page's h1 (pages whose body has no other h1). Children are absolutely placeable against the bar.
 */
export function TopBar({ section, icon, title, heading, children }: {
  section: string; icon: IconName; title: string; heading?: boolean; children?: React.ReactNode;
}) {
  const Title = heading ? "h1" : "span";
  return (
    <div className="sticky top-0 z-10 flex min-h-16.25 items-center justify-between gap-3 border-b border-app-line bg-app px-4 py-3 sm:px-8 lg:min-h-20.25 lg:py-5">
      <div className="flex min-w-0 items-center gap-2.5 text-[17px]">
        <span className="hidden text-app-muted sm:inline">{section}</span>
        <span aria-hidden className="hidden text-app-muted/50 sm:inline">/</span>
        <Icon name={icon} className="size-4.5 text-ink" />
        <Title className="truncate font-medium text-ink">{title}</Title>
      </div>
      {children}
    </div>
  );
}
