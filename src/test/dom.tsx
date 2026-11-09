// Test-only helpers for rendering route components under jsdom without a router.
// Use with `// @vitest-environment jsdom` and:
//   vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig()), ...(await import("@/test/dom")).routerStubs }));
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NEIGHBORHOOD_SEED } from "@/features/neighborhoods/queries";

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  to?: string; params?: Record<string, string>; search?: Record<string, string>; hash?: string; activeProps?: unknown; activeOptions?: unknown;
};
const fill = (to: string, params: Record<string, string> = {}) => to.replace(/\$(\w+)/g, (_, k: string) => params[k] ?? "");

export const routerStubs = {
  Link: ({ to, params, search, hash, children, activeProps: _a, activeOptions: _o, ...rest }: LinkProps) => (
    <a href={`${fill(to ?? "", params)}${search ? `?${new URLSearchParams(search)}` : ""}${hash ? `#${hash}` : ""}`} {...rest}>{children}</a>
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

/**
 * Renders `ui` with a QueryClient pre-seeded with `[queryKey, data]` pairs; seeded data never refetches.
 * Neighborhoods are always seeded fresh: their mount fetch would otherwise take a queued fake result.
 */
export function renderWithQueries(ui: React.ReactElement, seed: [readonly unknown[], unknown][] = []) {
  installDomStubs();
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  for (const [key, data] of [[["neighborhoods"], NEIGHBORHOOD_SEED] as const, ...seed]) queryClient.setQueryData(key, data);
  return { queryClient, ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>) };
}

/**
 * jsdom has no modal dialog: stubs `showModal`/`close` on the prototype so they toggle `open`, move focus
 * into the dialog, and fire `close` like a browser. Returns a restore function for `afterEach`.
 */
export function stubDialog() {
  const proto = HTMLDialogElement.prototype;
  const saved = (["showModal", "close"] as const).map((k) => [k, Object.getOwnPropertyDescriptor(proto, k)] as const);
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
    this.querySelector<HTMLElement>("[autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")?.focus();
  };
  proto.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  return () => {
    for (const [k, d] of saved) {
      if (d) Object.defineProperty(proto, k, d);
      else delete (proto as Partial<HTMLDialogElement>)[k];
    }
  };
}
