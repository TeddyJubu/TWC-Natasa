// The admin pages' shell on the airmail desk: a paper sidebar (a drawer below lg), top bar, and the page column.
// /account uses AirShell (a top bar and account menu, no sidebar). Public pages use AppNav/AppFooter. See DESIGN.md "Internal tools".
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ConstellationLogo, cn, initials } from "@/index";
import { Icon } from "./icons";
import { groups, useActiveSection, type NavItem, type ShellPage } from "./shell-nav";
import { ring, secondaryButton } from "./app-classes";
import { useSignOut } from "./sign-out";
import { useButtonSparkles } from "./sparkles";

/** The constellation and the collective's name, linking home. */
function Brand({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="The Women’s Collective home" className={cn("air-brand min-w-0 px-1.5 leading-tight whitespace-normal text-ink", ring, className)}>
      <ConstellationLogo variant="ink" alt="" className="w-7 shrink-0" />
      <span className="min-w-0">The Women’s Collective</span>
    </Link>
  );
}

/** A card on this page is an in-page anchor (aria-current while it's in view); anything else is a router link. */
function NavLink({ item, page, active, onNavigate }: { item: NavItem; page: ShellPage; active: string; onNavigate?: () => void }) {
  const here = item.to === page && !!item.hash;
  const current = here && item.hash === active;
  const cls = cn(
    "flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm/[1.3] transition-colors duration-150 motion-reduce:transition-none",
    current ? "bg-ink font-semibold text-app shadow-air-lift" : "font-medium text-app-muted hover:bg-air-tint hover:text-ink", ring,
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
    <ul className="flex flex-col gap-0.5">
      {items.map((i) => <NavLink key={`${i.to}#${i.hash}`} item={i} page={page} active={active} onNavigate={onNavigate} />)}
    </ul>
  );
  return (
    <>
      <nav aria-label="Main" className="flex flex-col">
        {groups(admin).map((g) => (
          <details key={g.label} open className="group flex flex-col gap-0.5">
            <summary className={cn("twc-eyebrow flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-full px-3.5 pt-4 pb-2 uppercase [&::-webkit-details-marker]:hidden", ring)}>
              {g.label} <Icon name="chevron-down" className="size-3 -rotate-90 transition-transform group-open:rotate-0 motion-reduce:transition-none" />
            </summary>
            {list(g.items)}
          </details>
        ))}
      </nav>
      <div className="mt-auto border-t border-air-line pt-3">
        <button type="button" onClick={onSignOut} className={cn(secondaryButton, "w-full")}>
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
    <div className="air-panel sticky top-0 z-20 flex items-center justify-between gap-3 rounded-none px-4 py-3 lg:hidden">
      <Brand />
      <button
        ref={button} type="button" aria-label="Open menu" aria-expanded={open} aria-controls="app-drawer" onClick={() => setOpen(true)}
        className={cn("air-icon-btn shrink-0 text-ink", ring)}
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
              <button type="button" aria-label="Close menu" onClick={close} className={cn("air-icon-btn shrink-0 text-ink", ring)}>
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
    <div className="app-ground air min-h-screen text-ink lg:flex">
      <MobileBar page={page} admin={admin} active={active} onSignOut={signOut} />
      <aside className="air-panel sticky top-8 my-8 ml-6 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 flex-col gap-1 overflow-y-auto p-3 lg:flex">
        <Brand className="px-2 pt-1" />
        <ShellNav page={page} admin={admin} active={active} onSignOut={signOut} />
      </aside>
      <div className="min-w-0 flex-1">
        {error && <p role="alert" className="air-panel mx-4 mt-4 px-4 py-3 text-sm text-danger sm:mx-8">{error}</p>}
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
    <div className="air-panel sticky top-0 z-10 flex min-h-16 flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-none px-4 py-3.5 sm:px-8 lg:mt-8 lg:mr-8 lg:ml-8 lg:max-w-234 lg:rounded-air-card lg:py-5">
      <Title className="air-title min-w-0 truncate pb-1 text-ink">{title}</Title>
      {who && (
        <div className="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-ink">
          {who.avatar
            ? <span className="air-avatar"><img src={who.avatar} alt="" /></span>
            : <span aria-hidden className="air-avatar">{initials(who.name)}</span>}
          <span className="truncate">{who.name}</span>
        </div>
      )}
    </div>
  );
}
