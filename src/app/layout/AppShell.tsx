// The admin pages' shell on the canvas: the leader nav in a sidebar ruled off in ink (a drawer below lg), a page-head
// top bar over a hairline, and the page column.
// /account uses AirShell (a top bar and account menu, no sidebar). Public pages use AppNav/AppFooter. See DESIGN.md "Internal tools".
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTrigger } from "@ui-sdk/react/drawer";
import { LOCKUP, cn, initials } from "@/index";
import { Icon, type IconName } from "./icons";
import { useWaiting } from "@/features/admin/waiting";
import { ADMIN_AREAS, areaOf, sectionItem, type AdminSection, type ShellPage } from "./shell-nav";
import { ring, secondaryButton } from "./app-classes";
import { useSignOut } from "./sign-out";
import { useButtonSparkles } from "./sparkles";
import { ConfirmHost } from "./ConfirmHost";

/** The canvas's lockup (the three stars and the name), linking home. */
function Brand({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="The Women’s Collective home" className={cn("air-brand self-start px-1.5", ring, className)}>
      <img src={LOCKUP.src} width={LOCKUP.width} height={LOCKUP.height} alt="" className="h-[61px] w-auto" />
    </Link>
  );
}

/** One sidebar row: a section's page, or Home/Forms; `badge` is how much waits on you there. */
function ShellLink({ section, to = "/admin", icon, label, current, badge, onNavigate }: {
  section?: AdminSection; to?: "/admin" | "/admin/forms"; icon: IconName; label: string; current: boolean; badge?: number; onNavigate?: () => void;
}) {
  const cls = cn(
    "relative flex min-h-11 w-full items-center gap-3 border-b border-air-line pr-2 pl-3.5 text-sm/[1.3] transition-colors duration-150 motion-reduce:transition-none",
    "before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:bg-ink before:opacity-0 before:transition-opacity motion-reduce:before:transition-none",
    current ? "font-semibold text-ink before:opacity-100" : "font-medium text-app-muted hover:bg-air-sky hover:text-ink", ring,
  );
  const body = (
    <>
      <Icon name={icon} className={cn("size-4.5", !current && "opacity-75")} />
      <span className="flex-1">{label}</span>
      {!!badge && <><span aria-hidden className="min-w-6 rounded-full bg-app-pending px-1.5 text-center text-xs/5 font-semibold text-ink tabular-nums shadow-[inset_0_0_0_1px_var(--color-ink)]">{badge}</span><span className="sr-only">, {badge} waiting</span></>}
    </>
  );
  const here = current ? "page" as const : undefined;
  return section
    ? <Link to="/admin/$section" params={{ section }} aria-current={here} className={cls} onClick={onNavigate}>{body}</Link>
    : <Link to={to} aria-current={here} className={cls} onClick={onNavigate}>{body}</Link>;
}

/** Home, the four areas, then Admin activity and Sign out; the same markup fills the sidebar and the drawer. */
function ShellNav({ page, onSignOut, onNavigate }: { page: ShellPage; onSignOut: () => void; onNavigate?: () => void }) {
  const { counts } = useWaiting();
  const here = areaOf(page);
  return (
    <>
      <nav aria-label="Main" className="mt-4">
        <ul className="flex flex-col border-t border-ink">
          <li><ShellLink icon="house" label="Home" current={page === "/admin"} onNavigate={onNavigate} /></li>
          {ADMIN_AREAS.map((a) => (
            <li key={a.label}>
              <ShellLink section={a.forms ? undefined : a.sections[0]} to={a.forms ? "/admin/forms" : undefined} icon={a.icon} label={a.label} current={a === here}
                badge={a.sections.reduce((n, s) => n + (counts[s] ?? 0), 0)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto flex flex-col gap-3 pt-6">
        <ul className="border-t border-ink"><li>
        <ShellLink section="activity" icon={sectionItem("activity").icon} label={sectionItem("activity").label} current={page === "/admin/activity"} onNavigate={onNavigate} />
        </li></ul>
        <button type="button" onClick={onSignOut} className={cn(secondaryButton, "w-full")}>
          <Icon name="log-out" className="size-4.5" />Sign out
        </button>
      </div>
    </>
  );
}

/** Below lg: the brand and a menu button opening the nav in a modal left drawer (focus trapped, Escape closes). */
function MobileBar(props: { page: ShellPage; onSignOut: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="air-panel sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-ink px-4 py-2.5 lg:hidden">
      <Brand />
      <Drawer side="left" open={open} onOpenChange={setOpen}>
        <DrawerTrigger aria-label="Open menu" className={cn("air-icon-btn shrink-0 text-ink", ring)}>
          <Icon name="menu" className="size-5" />
        </DrawerTrigger>
        <DrawerBackdrop className="fixed inset-0 bg-black/40" />
        <DrawerContent aria-label="Menu" className="h-dvh w-[min(20rem,85vw)] overflow-y-auto bg-app text-ink shadow-[1.5px_0_0_var(--color-ink)]">
          <div className="flex min-h-full flex-col gap-3 px-4 pt-4 pb-6">
            <div className="flex items-center gap-2">
              <Brand className="flex-1" />
              <DrawerClose aria-label="Close menu" className={cn("air-icon-btn shrink-0 text-ink", ring)}>
                <Icon name="x" className="size-5" />
              </DrawerClose>
            </div>
            <ShellNav {...props} onNavigate={() => setOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/**
 * Sidebar + page column for an internal page, on the white ground (Archivo throughout: `app-ground` points the
 * script face at it). `children` is the page's one `<main id="main" tabIndex={-1}>`, starting with its
 * `TopBar` (the admin pages) or its own header (/account's cover). Sign out lives here; a failed sign-out shows above the page.
 */
export function AppShell({ page, children }: { page: ShellPage; children: React.ReactNode }) {
  const { signOut, error } = useSignOut();
  useButtonSparkles();
  // Cards land below the sticky bar when a sidebar link jumps to them: the menu bar on phones, the TopBar from lg.
  return (
    <div className="app-ground air min-h-screen text-ink lg:flex [&_.air-card]:scroll-mt-22 lg:[&_.air-card]:scroll-mt-28">
      <ConfirmHost />
      <MobileBar page={page} onSignOut={signOut} />
      <aside className="air-panel sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-ink px-5 pt-6 pb-6 lg:flex">
        <Brand />
        <ShellNav page={page} onSignOut={signOut} />
      </aside>
      <div className="min-w-0 flex-1">
        {error && <p role="alert" className="mx-4 mt-4 px-4 py-3 text-sm text-danger shadow-[inset_0_0_0_1.5px_currentColor] sm:mx-8">{error}</p>}
        {children}
      </div>
    </div>
  );
}

/** Who is signed in, at the top bar's end: her portrait (or initials) and name. */
export type Who = { name: string; avatar?: string };

/**
 * The page head atop the column (canvas .phd: a giant heavy condensed title over a hairline ink rule; sticky from lg,
 * where it shrinks to a bar; on phones the menu bar is the one that sticks) and who is signed in. `heading` makes the title
 * the page's h1 (pages whose body has no other h1).
 */
export function TopBar({ title, heading, who }: { title: string; heading?: boolean; who?: Who }) {
  const Title = heading ? "h1" : "p";
  return (
    <div className="air-panel z-10 flex flex-wrap items-end justify-between gap-x-5 gap-y-3 border-b border-ink px-4 pt-8 pb-4 sm:px-8 lg:sticky lg:top-0 lg:max-w-250 lg:pt-12">
      <Title className="air-title min-w-0 truncate text-ink">{title}</Title>
      {who && (
        <Link to="/account" aria-label={`${who.name}, your account`} className={cn("mb-1 flex min-w-0 items-center gap-2.5 rounded-full text-sm font-semibold text-ink underline-offset-4 hover:underline", ring)}>
          {who.avatar
            ? <span className="air-avatar"><img src={who.avatar} alt="" /></span>
            : <span aria-hidden className="air-avatar">{initials(who.name)}</span>}
          <span className="truncate">{who.name}</span>
        </Link>
      )}
    </div>
  );
}

/** An area's pages as tabs under the top bar. Links, so each keeps its own address; none for a one-page area. */
export function AreaTabs({ page }: { page: ShellPage }) {
  const area = areaOf(page);
  if (!area || area.sections.length + (area.forms ? 1 : 0) < 2) return null;
  const cls = (current: boolean) => cn(
    "-mb-px inline-flex min-h-11 items-center border-b-2 px-0.5 text-sm transition-colors duration-150 motion-reduce:transition-none", ring,
    current ? "border-ink font-semibold text-ink" : "border-transparent font-medium text-app-muted hover:text-ink",
  );
  return (
    <nav aria-label={`${area.label} pages`} className="flex flex-wrap gap-x-5 border-b border-air-line">
      {area.forms && <Link to="/admin/forms" aria-current={page === "/admin/forms" ? "page" : undefined} className={cls(page === "/admin/forms")}>Forms</Link>}
      {area.sections.map((s) => (
        <Link key={s} to="/admin/$section" params={{ section: s }} aria-current={page === `/admin/${s}` ? "page" : undefined} className={cls(page === `/admin/${s}`)}>
          {sectionItem(s).label}
        </Link>
      ))}
    </nav>
  );
}
