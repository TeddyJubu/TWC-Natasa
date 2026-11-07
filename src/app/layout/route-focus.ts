import * as React from "react";

// ponytail: a page that takes longer than this to render its h1 keeps focus on #main (or wherever it is).
const WAIT_MS = 10_000;

/**
 * After a client-side route change, move focus to the new page so screen readers announce it and the next
 * Tab starts from its top: the `h1` inside `#main` (made programmatically focusable), else `#main` itself.
 * Loading screens render `#main` (or nothing) before the h1, so it keeps watching briefly until the h1 exists,
 * but never takes focus back once the user has moved it. Skips the first load (nothing to announce) and URLs
 * with a hash (the browser scrolls to the target).
 */
export function useRouteFocus(pathname: string) {
  const previous = React.useRef(pathname);
  React.useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    if (window.location.hash) return;
    const start = document.activeElement;
    const userMovedFocus = () => {
      const active = document.activeElement;
      return !!active && active !== start && active !== document.body && active.id !== "main";
    };
    /** Places focus; true once there is nothing left to wait for. */
    const place = () => {
      if (userMovedFocus()) return true;
      const main = document.getElementById("main");
      if (!main) return false;
      const h1 = main.querySelector<HTMLElement>("h1");
      if (h1 && !h1.hasAttribute("tabindex")) h1.setAttribute("tabindex", "-1");
      const target = h1 ?? main;
      if (document.activeElement !== target) target.focus({ preventScroll: true });
      return !!h1;
    };
    if (place()) return;
    const observer = new MutationObserver(() => place() && stop());
    const timer = window.setTimeout(() => stop(), WAIT_MS);
    function stop() {
      observer.disconnect();
      window.clearTimeout(timer);
    }
    observer.observe(document.body, { childList: true, subtree: true });
    return stop;
  }, [pathname]);
}
