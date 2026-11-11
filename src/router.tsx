import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { getGlobalStartContext } from "@tanstack/react-start";
import { routeTree } from "./routeTree.gen";
import { ErrorPage, NotFound } from "@/app/layout/StatusPages";

/**
 * The request's CSP nonce from securityHeadersMiddleware (src/app/security-headers.ts), on the server only: the
 * router puts it on every inline SSR script and in a `csp-nonce` meta, which the browser's router reads back.
 */
export function requestNonce(): string | undefined {
  try {
    return (getGlobalStartContext() as { nonce?: string } | undefined)?.nonce;
  } catch {
    return undefined; // no request (or its middleware hasn't run): no nonce
  }
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Hovering or focusing a link fetches its route chunk and loader; staleTime 0 leaves caching to TanStack Query.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: ErrorPage,
    ssr: { nonce: requestNonce() },
  });

  return router;
};
