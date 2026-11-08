// The /account settings-app shell: sidebar (a drawer below lg), top bar, and the page column.
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ConstellationLogo, cn } from "@/index";
import { Icon, type IconName } from "./icons";
import { primaryButton, ring, secondaryButton } from "./helpers";

type NavItem = { label: string; icon: IconName } & ({ to: "/" | "/members" | "/admin" } | { anchor: string });

const MY_ACCOUNT: NavItem[] = [
  { label: "Profile", icon: "circle-user-round", anchor: "profile" },
  { label: "Public card", icon: "id-card", anchor: "public-card" },
  { label: "Visibility", icon: "eye", anchor: "visibility" },
  { label: "Headshot session", icon: "camera", anchor: "headshot" },
];
const collective = (admin: boolean): NavItem[] => [
  { label: "Home", icon: "house", to: "/" },
  { label: "Members", icon: "users", to: "/members" },
  { label: "Gatherings", icon: "calendar-days", anchor: "gatherings" },
  { label: "Introductions", icon: "handshake", anchor: "introductions" },
  ...(admin ? [{ label: "Admin", icon: "shield-check", to: "/admin" } as const] : []),
];
const ANCHORS = ["profile", "public-card", "visibility", "headshot", "gatherings", "introductions"];

/** The anchored card nearest the top of the viewport, or the one the URL hash names. */
function useActiveSection() {
  const [active, setActive] = React.useState(ANCHORS[0]);
  React.useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (ANCHORS.includes(id)) setActive(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    // A band across the upper third: whichever anchored card crosses it is "here".
    const observer = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) setActive(e.target.id); },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    for (const id of ANCHORS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => {
      window.removeEventListener("hashchange", fromHash);
      observer.disconnect();
    };
  }, []);
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

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const cls = cn(
    "flex w-full items-center gap-3.5 rounded-[10px] px-3 py-2.5 text-[15.5px] transition-colors",
    active ? "bg-app-line font-medium text-ink" : "text-ink hover:bg-app-line/50", ring,
  );
  const body = <><Icon name={item.icon} className={cn("size-4.75", active ? "text-ink" : "text-ink-muted")} />{item.label}</>;
  return (
    <li>
      {"to" in item
        ? <Link to={item.to} className={cls} onClick={onNavigate}>{body}</Link>
        : <a href={`#${item.anchor}`} aria-current={active ? "location" : undefined} className={cls} onClick={onNavigate}>{body}</a>}
    </li>
  );
}

/** Both nav groups and Sign out; the same markup fills the sidebar and the drawer. */
function AccountNav({ admin, onSignOut, onNavigate }: { admin: boolean; onSignOut: () => void; onNavigate?: () => void }) {
  const active = useActiveSection();
  const item = (i: NavItem) => <NavLink key={i.label} item={i} active={"anchor" in i && i.anchor === active} onNavigate={onNavigate} />;
  return (
    <>
      <nav aria-label="Account" className="flex flex-col gap-7">
        <div className="flex flex-col gap-0.5">
          <p className="px-3 pb-2 text-sm text-app-muted">Collective</p>
          <ul className="flex flex-col gap-0.5">{collective(admin).map(item)}</ul>
        </div>
        <details open className="group flex flex-col gap-0.5">
          <summary className={cn("flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md px-3 pb-2 text-sm text-app-muted [&::-webkit-details-marker]:hidden", ring)}>
            My Account <Icon name="chevron-down" className="size-3.25 -rotate-90 transition-transform group-open:rotate-0" />
          </summary>
          <ul className="flex flex-col gap-0.5">{MY_ACCOUNT.map(item)}</ul>
        </details>
      </nav>
      <button type="button" onClick={onSignOut} className={cn("mt-auto flex w-full items-center gap-3.5 rounded-[10px] px-3 py-2.5 text-[15.5px] text-ink-muted hover:bg-app-line/50", ring)}>
        <Icon name="log-out" className="size-4.75 text-app-muted" />Sign out
      </button>
    </>
  );
}

/** Below lg: the brand and a menu button opening the nav in a modal drawer (focus trapped, Escape closes). */
function MobileBar({ admin, onSignOut }: { admin: boolean; onSignOut: () => void }) {
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
        ref={button} type="button" aria-label="Open menu" aria-expanded={open} aria-controls="account-drawer" onClick={() => setOpen(true)}
        className={cn("grid size-10 shrink-0 place-items-center rounded-[9px] border border-app-line bg-app text-ink", ring)}
      >
        <Icon name="menu" className="size-5" />
      </button>
      <dialog
        ref={dialog} id="account-drawer" aria-label="Menu"
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
            <AccountNav admin={admin} onSignOut={onSignOut} onNavigate={close} />
          </div>
        )}
      </dialog>
    </div>
  );
}

/** Sidebar + page column. `children` is the page's <main>. */
export function AccountShell({ admin, onSignOut, children }: { admin: boolean; onSignOut: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-app text-ink lg:flex">
      <MobileBar admin={admin} onSignOut={onSignOut} />
      <aside className="sticky top-0 hidden h-dvh w-83 shrink-0 flex-col gap-7 overflow-y-auto border-r border-app-line bg-app-sunken px-4 pt-5.5 pb-6 lg:flex">
        <Brand />
        <AccountNav admin={admin} onSignOut={onSignOut} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * Breadcrumb, Preview and Save. Save submits `formId`, so every profile input (joined with `form=`) is validated
 * natively; it stays disabled until something changed.
 */
export function TopBar({ formId, dirty, pending, saved, error, onSubmit, onPreview }: {
  formId: string; dirty: boolean; pending: boolean; saved: boolean; error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; onPreview: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-app-line bg-app px-4 py-3 sm:px-8 lg:py-5">
      <p className="flex min-w-0 items-center gap-2.5 text-[17px]">
        <span className="hidden text-app-muted sm:inline">My Account</span>
        <span aria-hidden className="hidden text-app-muted/50 sm:inline">/</span>
        <Icon name="circle-user-round" className="size-4.5 text-ink" />
        <span className="font-medium text-ink">Profile</span>
      </p>
      <form id={formId} onSubmit={onSubmit} className="flex items-center gap-2.5">
        <span role="status" className="sr-only text-sm text-app-muted md:not-sr-only">{saved ? "Saved" : ""}</span>
        <button type="button" onClick={onPreview} className={secondaryButton}>
          <Icon name="eye" className="size-3.75 text-ink-muted" /><span>Preview<span className="sr-only sm:not-sr-only"> card</span></span>
        </button>
        <button type="submit" disabled={!dirty || pending} className={primaryButton}>{pending ? "Saving…" : "Save changes"}</button>
      </form>
      {error && <p role="alert" className="absolute top-full right-4 mt-2 max-w-sm rounded-lg border border-app-line bg-app px-3 py-2 text-sm text-danger shadow-[0_6px_18px_rgb(0_0_0/0.08)] sm:right-8">{error}</p>}
    </div>
  );
}
