// The internal pages' navigation: AppShell's sidebar and tabs (the admin pages), and which card is in view on /account
// (src/features/account/AirShell.tsx).
import * as React from "react";
import type { IconName } from "./icons";

/** The internal pages. `/admin/forms/edit` stands for any one form's edit page. */
export type ShellPage = "/account" | "/admin" | "/admin/forms" | "/admin/forms/edit" | `/admin/${AdminSection}`;
export type NavItem = { label: string; icon: IconName; to: "/account"; hash?: string };

export const MY_ACCOUNT: NavItem[] = [
  { label: "Profile", icon: "circle-user-round", to: "/account", hash: "profile" },
  { label: "Public card", icon: "id-card", to: "/account", hash: "public-card" },
  { label: "Visibility", icon: "eye", to: "/account", hash: "visibility" },
  { label: "Headshot session", icon: "camera", to: "/account", hash: "headshot" },
];
/**
 * Each section has its own page at /admin/<section>. A section's slug is also its card's id, so an old /admin#<slug>
 * link (in sent emails) forwards there.
 */
export const ADMIN_SECTIONS = ["inbox", "applications", "reviews", "bookings", "members", "newsletter", "spotlight", "events", "appointments", "neighborhoods", "activity"] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];
export const isAdminSection = (s: string): s is AdminSection => (ADMIN_SECTIONS as readonly string[]).includes(s);
const SECTION_ITEMS: Record<AdminSection, { label: string; icon: IconName }> = {
  inbox: { label: "Inbox", icon: "mail" },
  applications: { label: "Applications", icon: "notebook-pen" },
  reviews: { label: "Member reviews", icon: "message-circle" },
  bookings: { label: "Headshot bookings", icon: "camera" },
  members: { label: "All members", icon: "badge-check" },
  newsletter: { label: "Newsletter", icon: "newspaper" },
  spotlight: { label: "Spotlight answers", icon: "megaphone" },
  events: { label: "Events", icon: "calendar-days" },
  appointments: { label: "Appointments", icon: "calendar" },
  neighborhoods: { label: "Neighborhoods", icon: "map-pin" },
  activity: { label: "Admin activity", icon: "shield-check" },
};
/** A section's name and icon. */
export const sectionItem = (section: AdminSection) => SECTION_ITEMS[section];

/** The sidebar after Home: each area opens on its first page, its other pages are tabs. `forms`: /admin/forms is the first tab. */
export type AdminArea = { label: string; icon: IconName; sections: readonly AdminSection[]; forms?: boolean };
export const ADMIN_AREAS: AdminArea[] = [
  { label: "Inbox", icon: "mail", sections: ["inbox"] },
  { label: "People", icon: "badge-check", sections: ["applications", "members", "newsletter", "neighborhoods"] },
  { label: "Calendar", icon: "calendar-days", sections: ["events", "appointments", "bookings"] },
  { label: "Forms", icon: "pencil", sections: ["reviews", "spotlight"], forms: true },
];
export const areaOf = (page: ShellPage) =>
  ADMIN_AREAS.find((a) => a.sections.some((s) => page === `/admin/${s}`) || (a.forms && page.startsWith("/admin/forms")));

/**
 * This page's anchored card nearest the top of the viewport, or the one the URL hash names. One instance per page
 * (in AppShell), so opening the drawer never re-runs the arrival scroll.
 */
export function useActiveSection(page: ShellPage) {
  // Page groups first, so the top card (Profile, Applications) is "here" before anything scrolls.
  const anchors = MY_ACCOUNT.filter((i) => i.to === page && i.hash).map((i) => i.hash!);
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

