// Test-only helpers for rendering route components under jsdom without a router.
// Use with `// @vitest-environment jsdom` and:
//   vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig()), ...(await import("@/test/dom")).routerStubs }));
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  to?: string; search?: Record<string, string>; activeProps?: unknown; activeOptions?: unknown;
};

export const routerStubs = {
  Link: ({ to, search, children, activeProps: _a, activeOptions: _o, ...rest }: LinkProps) => (
    <a href={search ? `${to}?${new URLSearchParams(search)}` : to} {...rest}>{children}</a>
  ),
  useNavigate: () => () => undefined,
};

// Reduced motion keeps motion components static; IntersectionObserver never fires.
export function installDomStubs() {
  window.matchMedia ??= ((query: string) => ({
    matches: query.includes("reduce"), media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  } as unknown as typeof IntersectionObserver;
  const svgText = SVGElement.prototype as SVGElement & { getComputedTextLength?: () => number };
  svgText.getComputedTextLength ??= () => 0;
}

/** Renders `ui` with a QueryClient pre-seeded with `[queryKey, data]` pairs; seeded data never refetches. */
export function renderWithQueries(ui: React.ReactElement, seed: [readonly unknown[], unknown][] = []) {
  installDomStubs();
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  for (const [key, data] of seed) queryClient.setQueryData(key, data);
  return { queryClient, ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>) };
}
