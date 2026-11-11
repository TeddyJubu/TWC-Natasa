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
import { handleAuthEvent, onAuthEvent } from "@/app/auth-events";
import { OG_IMAGE, currentPathname, siteSeo } from "@/app/seo";
import { useRouteFocus } from "@/app/layout/route-focus";

import appCss from "../styles.css?url";
import { displayFontUrl } from "@/index";
import geistUrl from "@/assets/fonts/home/geist-variable.woff2?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: ({ matches }) => {
    // Read per call so tests can stub it; unset or invalid means no absolute-URL tags at all.
    const seo = siteSeo(import.meta.env.VITE_SITE_URL as string | undefined, currentPathname(matches), OG_IMAGE);
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "The Women’s Collective — Find Your People in Queens" },
        { name: "description", content: "A community for women founders, entrepreneurs, creatives, freelancers, professionals, and neighbors across Western Queens." },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "The Women’s Collective" },
        { property: "og:locale", content: "en_US" },
        { name: "twitter:card", content: "summary_large_image" },
        ...seo.meta,
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        // Headlines are set in the display face; fetch it with the CSS instead of after layout (T25).
        { rel: "preload", href: displayFontUrl, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
        // Geist is the body face of every page (styles.css @font-face): fetch it with the CSS too, not after it parses.
        { rel: "preload", href: geistUrl, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
        // The constellation star on a white tile (public/), so it reads on light and dark tabs alike.
        { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
        { rel: "icon", href: "/favicon.png", type: "image/png", sizes: "192x192" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
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

// Keep this root providers-only: every page brings its own chrome.
function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();
  const router = useRouter();
  // Focus only, no markup. resolvedLocation changes only once the new
  // page (lazy chunk, loaders) has rendered; location changes at navigation start, while the old page is still up.
  const resolvedPathname = useRouterState({ select: (s) => (s.resolvedLocation ?? s.location).pathname });
  useRouteFocus(resolvedPathname);
  // Sign-ins and sign-outs (this tab or another) refresh the router and the caches.
  useEffect(
    () => onAuthEvent((event) => handleAuthEvent(event, queryClient, () => void router.invalidate())),
    [router, queryClient],
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <div key={location.pathname} className="motion-route-in">
        <Outlet />
      </div>
    </QueryClientProvider>
  );
}
