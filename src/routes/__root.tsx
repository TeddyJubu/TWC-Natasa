import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useLocation,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { getSupabase } from "@/app/supabase";
import { handleAuthEvent } from "@/app/auth-events";
import { currentPathname, siteSeo } from "@/app/seo";
import { useRouteFocus } from "@/app/layout/route-focus";
import hero from "@/assets/photography/hero.jpg";

import appCss from "../styles.css?url";
import { displayFontUrl } from "@/index";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: ({ matches }) => {
    // Read per call so tests can stub it; unset or invalid means no absolute-URL tags at all.
    const seo = siteSeo(import.meta.env.VITE_SITE_URL as string | undefined, currentPathname(matches), hero);
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "The Women’s Collective — Find Your People in Queens" },
        { name: "description", content: "A community for women founders, entrepreneurs, creatives, freelancers, professionals, and neighbors across Western Queens." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...seo.meta,
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        // Headlines are set in the display face; fetch it with the CSS instead of after layout (T25).
        { rel: "preload", href: displayFontUrl, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
        { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
        ...seo.links,
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// Keep this root providers-only: canvas preview routes (/__mockup,
// /__component) render inside it, so any chrome leaks into every frame.
function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();
  const router = useRouter();
  // Focus only, no markup: preview frames render inside this root. resolvedLocation changes only once the new
  // page (lazy chunk, loaders) has rendered; location changes at navigation start, while the old page is still up.
  const resolvedPathname = useRouterState({ select: (s) => (s.resolvedLocation ?? s.location).pathname });
  useRouteFocus(resolvedPathname);
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void getSupabase().then((supabase) => {
      if (cancelled) return;
      const { data } = supabase.auth.onAuthStateChange((event) => handleAuthEvent(event, queryClient, () => void router.invalidate()));
      unsubscribe = () => data.subscription.unsubscribe();
    }).catch((error) => console.error("[auth] listener setup failed", error));
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <div key={location.pathname} className="motion-route-in">
        <Outlet />
      </div>
    </QueryClientProvider>
  );
}
