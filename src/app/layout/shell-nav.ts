// The internal pages' navigation: which cards each page anchors, and which one is in view. Shared by AppShell's
// sidebar (the admin pages) and /account's tabs (src/features/account/AirShell.tsx).
import * as React from "react";
import type { IconName } from "./icons";

/** The internal pages: each renders `AppShell` with its own path. */
/** `/admin/forms/edit` stands for any one form's edit page: no sidebar card is "here" on it. */
export type ShellPage = "/account" | "/admin" | "/admin/forms" | "/admin/forms/edit";
export type NavItem = { label: string; icon: IconName; to: "/account" | "/admin" | "/admin/forms"; hash?: string };
export type NavGroup = { label: string; items: NavItem[] };

export const MY_ACCOUNT: NavItem[] = [
  { label: "Profile", icon: "circle-user-round", to: "/account", hash: "profile" },
  { label: "Public card", icon: "id-card", to: "/account", hash: "public-card" },
  { label: "Visibility", icon: "eye", to: "/account", hash: "visibility" },
  { label: "Headshot session", icon: "camera", to: "/account", hash: "headshot" },
];
export const ADMIN: NavItem[] = [
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
export const FORMS: NavItem[] = [
  { label: "All forms", icon: "notebook-pen", to: "/admin/forms", hash: "forms" },
];

/**
 * The Admin and Forms groups only for admins; UX only, since /admin's guard and every admin server function check again.
 */
export const groups = (admin: boolean): NavGroup[] => [
  { label: "My account", items: MY_ACCOUNT },
  ...(admin ? [{ label: "Admin", items: ADMIN }, { label: "Forms", items: FORMS }] : []),
];

/**
 * This page's anchored card nearest the top of the viewport, or the one the URL hash names. One instance per page
 * (in AppShell), so opening the drawer never re-runs the arrival scroll.
 */
export function useActiveSection(page: ShellPage) {
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

