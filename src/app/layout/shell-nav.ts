// The internal pages' navigation: which cards each page anchors, and which one is in view. Shared by AppShell's
// sidebar (the admin pages) and /account's tabs (src/features/account/AirShell.tsx).
import * as React from "react";
import type { IconName } from "./icons";

/** The internal pages: each renders `AppShell` with its own path. */
/** `/admin/forms/edit` stands for any one form's edit page: no sidebar card is "here" on it. */
export type ShellPage = "/account" | "/admin" | "/admin/forms" | "/admin/forms/edit" | `/admin/${AdminSection}`;
/** `section`: one of the admin's own pages, /admin/<section> (a router link, current while you're on it). */
export type NavItem = { label: string; icon: IconName; to: "/account" | "/admin" | "/admin/forms"; hash?: string; section?: AdminSection };
export type NavGroup = { label: string; items: NavItem[] };

export const MY_ACCOUNT: NavItem[] = [
  { label: "Profile", icon: "circle-user-round", to: "/account", hash: "profile" },
  { label: "Public card", icon: "id-card", to: "/account", hash: "public-card" },
  { label: "Visibility", icon: "eye", to: "/account", hash: "visibility" },
  { label: "Headshot session", icon: "camera", to: "/account", hash: "headshot" },
];
/**
 * The admin's pages: /admin is the overview, and each section has its own page at /admin/<section>. Work that waits on
 * someone comes first. A section's slug is also its card's id, so an old /admin#<slug> link (in sent emails) forwards there.
 */
export const ADMIN_SECTIONS = ["inbox", "applications", "reviews", "bookings", "members", "newsletter", "spotlight", "gatherings", "appointments", "neighborhoods", "activity"] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];
export const isAdminSection = (s: string): s is AdminSection => (ADMIN_SECTIONS as readonly string[]).includes(s);
export const ADMIN: NavItem[] = [
  { label: "Overview", icon: "house", to: "/admin" },
  // Forms are their own pages (/admin/forms), and second only to the overview.
  { label: "Forms", icon: "pencil", to: "/admin/forms", hash: "forms" },
  { label: "Inbox", icon: "mail", to: "/admin", section: "inbox" },
  { label: "Applications", icon: "notebook-pen", to: "/admin", section: "applications" },
  { label: "Member reviews", icon: "message-circle", to: "/admin", section: "reviews" },
  { label: "Headshot bookings", icon: "camera", to: "/admin", section: "bookings" },
  { label: "All members", icon: "badge-check", to: "/admin", section: "members" },
  { label: "Newsletter", icon: "newspaper", to: "/admin", section: "newsletter" },
  { label: "Spotlight answers", icon: "megaphone", to: "/admin", section: "spotlight" },
  { label: "Gatherings", icon: "calendar-days", to: "/admin", section: "gatherings" },
  { label: "Appointments", icon: "calendar", to: "/admin", section: "appointments" },
  { label: "Neighborhoods", icon: "map-pin", to: "/admin", section: "neighborhoods" },
  { label: "Admin activity", icon: "shield-check", to: "/admin", section: "activity" },
];
/** A section's sidebar entry (its label and icon). */
export const sectionItem = (section: AdminSection) => ADMIN.find((i) => i.section === section)!;

/**
 * The Admin group only for admins; UX only, since /admin's guard and every admin server function check again.
 */
export const groups = (admin: boolean): NavGroup[] => [
  { label: "My account", items: MY_ACCOUNT },
  ...(admin ? [{ label: "Admin", items: ADMIN }] : []),
];

/**
 * This page's anchored card nearest the top of the viewport, or the one the URL hash names. One instance per page
 * (in AppShell), so opening the drawer never re-runs the arrival scroll.
 */
export function useActiveSection(page: ShellPage) {
  // Page groups first, so the top card (Profile, Applications) is "here" before anything scrolls.
  const anchors = [...MY_ACCOUNT, ...ADMIN].filter((i) => i.to === page && i.hash).map((i) => i.hash!);
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

