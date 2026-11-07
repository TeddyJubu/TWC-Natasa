// @vitest-environment jsdom
// AppNav and AppFooter under a real (memory-history) TanStack router: internal links navigate client-side.
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
        <AppNav
          hideOnScroll={false}
          links={[
            { label: "Members", href: "/members" },
            { label: "Mission", href: "/#mission" },
            { label: "Elsewhere", href: "https://example.com/" },
          ]}
        />
        <Outlet />
        <AppFooter links={[{ label: "Join", href: "/join" }]} />
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
    const link = screen.getByRole("link", { name: "Members" });
    expect(link.getAttribute("href")).toBe("/members");
    // The click is handled by the router, not by the browser.
    expect(await click(link)).toBe(true);
    await waitFor(() => expect(router.state.location.pathname).toBe("/members"));
    expect(await screen.findByText("Members page")).toBeTruthy();
  });

  it("splits a path#hash href into the route and its hash", async () => {
    const router = await renderApp();
    await router.navigate({ to: "/members" });
    await screen.findByText("Members page");
    const link = screen.getByRole("link", { name: "Mission" });
    expect(link.getAttribute("href")).toBe("/#mission");
    expect(await click(link)).toBe(true);
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(router.state.location.hash).toBe("mission");
  });

  it("an internal footer link navigates client-side; external links stay plain", async () => {
    const router = await renderApp();
    // A plain anchor: the router leaves it to the browser.
    expect(await click(screen.getByRole("link", { name: "Elsewhere" }))).toBe(false);
    expect(router.state.location.pathname).toBe("/");
    expect(await click(screen.getByRole("link", { name: "Join" }))).toBe(true);
    await waitFor(() => expect(router.state.location.pathname).toBe("/join"));
  });
});
