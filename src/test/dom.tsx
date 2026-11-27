// Test-only helpers for rendering route components under jsdom without a router.
// Use with `// @vitest-environment jsdom` and:
//   vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig()), ...(await import("@/test/dom")).routerStubs }));
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react";
import { NEIGHBORHOOD_SEED } from "@/features/neighborhoods/queries";

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  to?: string; params?: Record<string, string>; search?: Record<string, string>; hash?: string; activeProps?: unknown; activeOptions?: unknown;
  /** History state: kept off the anchor, as the router does; tests read it as `data-state` JSON. */
  state?: Record<string, unknown>;
};
const fill = (to: string, params: Record<string, string> = {}) => to.replace(/\$(\w+)/g, (_, k: string) => params[k] ?? "");

export const routerStubs = {
  Link: ({ to, params, search, hash, state, children, activeProps: _a, activeOptions: _o, ...rest }: LinkProps) => (
    <a href={`${fill(to ?? "", params)}${search ? `?${new URLSearchParams(search)}` : ""}${hash ? `#${hash}` : ""}`} data-state={state ? JSON.stringify(state) : undefined} {...rest}>{children}</a>
  ),
  useNavigate: () => () => undefined,
  // No router, so nothing to block (/account's unsaved-changes guard; account-route.test.tsx checks its options).
  useBlocker: () => ({ status: "idle" }),
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

const listOf = (trigger: HTMLElement) => document.getElementById(trigger.getAttribute("aria-controls") ?? "");

/** The options of a ui-sdk Select, read by opening its list and closing it again. */
export function selectOptions(trigger: HTMLElement): HTMLElement[] {
  fireEvent.click(trigger);
  const options = [...(listOf(trigger)?.querySelectorAll<HTMLElement>("[role=option]") ?? [])];
  fireEvent.click(trigger);
  return options;
}

/** Chooses by value in a ui-sdk Select the way a person does: opens the list and presses the option. */
export function chooseValue(trigger: HTMLElement, value: string) {
  fireEvent.click(trigger);
  const option = [...(listOf(trigger)?.querySelectorAll<HTMLElement>("[role=option]") ?? [])].find((o) => o.dataset.value === value);
  if (!option) throw new Error(`No option with value "${value}"`);
  fireEvent.click(option);
}
