import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useLocation,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { getSupabase } from "@/app/supabase";
import { handleAuthEvent } from "@/app/auth-events";

import appCss from "../styles.css?url";
import { ImageTrail } from "@/index";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "The Women’s Collective Design System" },
      { name: "description", content: "The editorial design system for The Women’s Collective in Western Queens." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
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
      <ImageTrail />
    </QueryClientProvider>
  );
}
