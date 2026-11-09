// @vitest-environment jsdom
// AppNav and AppFooter under a real (memory-history) TanStack router: internal links navigate client-side.
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { AppFooter, AppNav } from "@/app/layout/AppLayout";
import { installDomStubs } from "@/test/dom";

afterEach(cleanup);

function makeRouter() {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <AppNav />
        <Outlet />
        <AppFooter />
      </>
    ),
  });
  const page = (path: string, text: string) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => <p>{text}</p> });
  const routeTree = rootRoute.addChildren([page("/", "Home page"), page("/members", "Members page"), page("/join", "Join page")]);
  return createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/"] }) });
}

/** Clicks `el` and reports whether something on the page (the router) prevented the browser's default navigation. */
async function click(el: HTMLElement) {
  let prevented = false;
  const observe = (e: Event) => {
    prevented = e.defaultPrevented;
    e.preventDefault(); // jsdom does not implement document navigation
  };
  document.addEventListener("click", observe);
  await act(async () => {
    fireEvent.click(el);
  });
  document.removeEventListener("click", observe);
  return prevented;
}

async function renderApp() {
  installDomStubs();
  window.scrollTo = () => undefined; // the router restores scroll; jsdom does not implement it
  const router = makeRouter();
  render(<RouterProvider router={router} />);
  await screen.findByText("Home page");
  return router;
}

describe("AppNav and AppFooter under a real router", () => {
  it("an internal nav link changes the router location client-side", async () => {
    const router = await renderApp();
    const link = within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Members" });
    expect(link.getAttribute("href")).toBe("/members");
    // The click is handled by the router, not by the browser.
    expect(await click(link)).toBe(true);
    await waitFor(() => expect(router.state.location.pathname).toBe("/members"));
    expect(await screen.findByText("Members page")).toBeTruthy();
  });

  it("the active page's nav link carries aria-current, the home logo only on /", async () => {
    const router = await renderApp();
    const home = () => screen.getAllByRole("link", { name: "The Women’s Collective home" })[0];
    expect(home().getAttribute("aria-current")).toBe("page");
    await router.navigate({ to: "/members" });
    await screen.findByText("Members page");
    expect(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Members" }).getAttribute("aria-current")).toBe("page");
    expect(home().getAttribute("aria-current")).toBeNull();
  });

  it("an internal footer link navigates client-side", async () => {
    const router = await renderApp();
    expect(await click(within(screen.getByRole("navigation", { name: "Footer" })).getByRole("link", { name: "Join" }))).toBe(true);
    await waitFor(() => expect(router.state.location.pathname).toBe("/join"));
  });
});
