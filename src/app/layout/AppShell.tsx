// The internal pages' settings-app shell (/account, /admin): sidebar (a drawer below lg), top bar, and the page column.
// Public pages use AppNav/AppFooter instead. See DESIGN.md "Internal pages".
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ConstellationLogo, cn, initials } from "@/index";
import { Icon, type IconName } from "./icons";
import { ring } from "./app-classes";
import { useSignOut } from "./sign-out";
import { useButtonSparkles } from "./sparkles";

/** The internal pages: each renders `AppShell` with its own path. */
/** `/admin/forms/edit` stands for any one form's edit page: no sidebar card is "here" on it. */
export type ShellPage = "/account" | "/admin" | "/admin/forms" | "/admin/forms/edit";
type NavItem = { label: string; icon: IconName; to: "/account" | "/admin" | "/admin/forms"; hash?: string };
type NavGroup = { label: string; items: NavItem[] };

const MY_ACCOUNT: NavItem[] = [
  { label: "Profile", icon: "circle-user-round", to: "/account", hash: "profile" },
  { label: "Public card", icon: "id-card", to: "/account", hash: "public-card" },
  { label: "Visibility", icon: "eye", to: "/account", hash: "visibility" },
  { label: "Headshot session", icon: "camera", to: "/account", hash: "headshot" },
];
const ADMIN: NavItem[] = [
  { label: "Inbox", icon: "mail", to: "/admin", hash: "inbox" },
  { label: "Applications", icon: "notebook-pen", to: "/admin", hash: "applications" },
  { label: "All members", icon: "badge-check", to: "/admin", hash: "members" },
  { label: "Newsletter", icon: "mail", to: "/admin", hash: "newsletter" },
  { label: "Admin activity", icon: "notebook-pen", to: "/admin", hash: "activity" },
  { label: "Member reviews", icon: "notebook-pen", to: "/admin", hash: "reviews" },
  { label: "Spotlight answers", icon: "notebook-pen", to: "/admin", hash: "spotlight" },
  { label: "Neighborhoods", icon: "map-pin", to: "/admin", hash: "neighborhoods" },
  { label: "Headshot bookings", icon: "calendar", to: "/admin", hash: "bookings" },
  { label: "Gatherings", icon: "calendar-days", to: "/admin", hash: "gatherings" },
];
const FORMS: NavItem[] = [
  { label: "All forms", icon: "notebook-pen", to: "/admin/forms", hash: "forms" },
];

/**
 * The Admin and Forms groups only for admins; UX only, since /admin's guard and every admin server function check again.
 */
const groups = (admin: boolean): NavGroup[] => [
  { label: "My account", items: MY_ACCOUNT },
  ...(admin ? [{ label: "Admin", items: ADMIN }, { label: "Forms", items: FORMS }] : []),
];

/**
 * This page's anchored card nearest the top of the viewport, or the one the URL hash names. One instance per page
 * (in AppShell), so opening the drawer never re-runs the arrival scroll.
 */
function useActiveSection(page: ShellPage) {
  // Page groups first, so the top card (Profile, Applications) is "here" before anything scrolls.
  const anchors = [...MY_ACCOUNT, ...ADMIN, ...FORMS].filter((i) => i.to === page && i.hash).map((i) => i.hash!);
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

/** The constellation and the collective's name, linking home. */
function Brand({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="The Women’s Collective home" className={cn("flex min-h-11 min-w-0 items-center gap-2.5 rounded-full px-1.5 font-geist text-base/[1.2] font-medium tracking-[-0.2px] text-ink", ring, className)}>
      <ConstellationLogo variant="ink" alt="" className="w-7.5 shrink-0" />
      <span className="min-w-0">The Women’s Collective</span>
    </Link>
  );
}

/** A card on this page is an in-page anchor (aria-current while it's in view); anything else is a router link. */
function NavLink({ item, page, active, onNavigate }: { item: NavItem; page: ShellPage; active: string; onNavigate?: () => void }) {
  const here = item.to === page && !!item.hash;
  const current = here && item.hash === active;
  const cls = cn(
    "flex min-h-11 w-full items-center gap-3 rounded-full px-3.5 text-[14.5px]/[1.3] transition-colors duration-150",
    current ? "bg-ink text-app shadow-[0_10px_18px_-12px_rgb(30_45_38/0.6)]" : "text-ink hover:bg-app-sunken", ring,
  );
  const body = <><Icon name={item.icon} className={cn("size-4.5", !current && "opacity-75")} />{item.label}</>;
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
    <ul className="flex flex-col gap-0.5 rounded-[18px] bg-app p-1.5 shadow-[0_1px_2px_rgb(30_45_38/0.05)]">
      {items.map((i) => <NavLink key={`${i.to}#${i.hash}`} item={i} page={page} active={active} onNavigate={onNavigate} />)}
    </ul>
  );
  return (
    <>
      <nav aria-label="Main" className="flex flex-col">
        {groups(admin).map((g) => (
          <details key={g.label} open className="group flex flex-col gap-0.5">
            <summary className={cn("twc-eyebrow flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-full px-3.5 py-2.5 text-[10.5px] tracking-[0.14em] text-app-muted [&::-webkit-details-marker]:hidden", ring)}>
              {g.label} <Icon name="chevron-down" className="size-3 -rotate-90 transition-transform group-open:rotate-0 motion-reduce:transition-none" />
            </summary>
            {list(g.items)}
          </details>
        ))}
      </nav>
      <div className="mt-auto pt-3">
        <button type="button" onClick={onSignOut} className={cn("flex min-h-12 w-full items-center gap-3 rounded-2xl bg-app px-5 text-[14.5px]/[1.3] text-ink shadow-[0_1px_2px_rgb(30_45_38/0.05)] transition-colors duration-150 hover:bg-app-sunken", ring)}>
          <Icon name="log-out" className="size-4.5" />Sign out
        </button>
      </div>
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
    <div className="app-glass sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 lg:hidden">
      <Brand />
      <button
        ref={button} type="button" aria-label="Open menu" aria-expanded={open} aria-controls="app-drawer" onClick={() => setOpen(true)}
        className={cn("grid size-11 shrink-0 place-items-center rounded-full bg-app text-ink shadow-[inset_0_0_0_1.5px_currentColor]", ring)}
      >
        <Icon name="menu" className="size-5" />
      </button>
      <dialog
        ref={dialog} id="app-drawer" aria-label="Menu"
        onClose={close}
        onKeyDown={(e) => { if (e.key === "Escape") close(); }}
        onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        className="m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none bg-app p-0 text-ink backdrop:bg-black/40"
      >
        {open && (
          <div className="flex min-h-full flex-col gap-3 px-4 pt-4 pb-6">
            <div className="flex items-center gap-2">
              <Brand className="flex-1" />
              <button type="button" aria-label="Close menu" onClick={close} className={cn("grid size-11 shrink-0 place-items-center rounded-full text-ink hover:bg-app-sunken", ring)}>
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
 * Sidebar + page column for an internal page, on the sage ground (Geist throughout: `app-ground` points the display,
 * script and editorial faces at it). `children` is the page's one `<main id="main" tabIndex={-1}>`, starting with its
 * `TopBar` (the admin pages) or its own header (/account's cover). Sign out lives here; a failed sign-out shows above the page.
 */
export function AppShell({ page, admin, children }: { page: ShellPage; admin: boolean; children: React.ReactNode }) {
  const { signOut, error } = useSignOut();
  const active = useActiveSection(page);
  useButtonSparkles();
  return (
    <div className="app-ground min-h-screen text-ink lg:flex">
      <MobileBar page={page} admin={admin} active={active} onSignOut={signOut} />
      <aside className="app-glass sticky top-8 my-8 ml-6 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 flex-col gap-2 overflow-y-auto rounded-[26px] p-2 lg:flex">
        <Brand className="px-2.5 pt-2" />
        <ShellNav page={page} admin={admin} active={active} onSignOut={signOut} />
      </aside>
      <div className="min-w-0 flex-1">
        {error && <p role="alert" className="mx-4 mt-4 rounded-2xl bg-app px-4 py-3 text-sm text-danger sm:mx-8">{error}</p>}
        {children}
      </div>
    </div>
  );
}

/** Who is signed in, at the top bar's end: her portrait (or initials) and name. */
export type Who = { name: string; avatar?: string };

/**
 * The sticky glass bar atop the page column: the page title and who is signed in. `heading` makes the title
 * the page's h1 (pages whose body has no other h1).
 */
export function TopBar({ title, heading, who }: { title: string; heading?: boolean; who?: Who }) {
  const Title = heading ? "h1" : "p";
  return (
    <div className="app-glass sticky top-0 z-10 flex min-h-16 flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 py-3.5 sm:px-8 lg:mt-8 lg:mr-8 lg:ml-8 lg:rounded-[26px] lg:py-4">
      <Title className="min-w-0 truncate font-geist text-[26px]/[1.25] font-medium tracking-[-0.4px] text-ink">{title}</Title>
      {who && (
        <div className="flex min-w-0 items-center gap-2.5 text-[15px]/[1.3] text-ink">
          {who.avatar
            ? <img src={who.avatar} alt="" className="size-9 shrink-0 rounded-full bg-app-sunken object-cover" />
            : <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-app-sunken font-geist text-sm">{initials(who.name)}</span>}
          <span className="truncate">{who.name}</span>
        </div>
      )}
    </div>
  );
}
