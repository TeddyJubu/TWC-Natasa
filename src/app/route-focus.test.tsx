// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRouteFocus } from "@/app/layout/route-focus";

let focus: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  focus = vi.spyOn(HTMLElement.prototype, "focus");
});
afterEach(() => {
  focus.mockRestore();
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

const page = (withH1: boolean) => {
  document.body.innerHTML = `<main id="main" tabindex="-1">${withH1 ? "<h1>Members</h1>" : "<p>No heading</p>"}</main>`;
  return { main: document.getElementById("main")!, h1: document.querySelector("h1") };
};
const mount = (pathname: string) => renderHook(({ path }) => useRouteFocus(path), { initialProps: { path: pathname } });

describe("useRouteFocus", () => {
  it("does nothing on first load", () => {
    page(true);
    mount("/");
    expect(focus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });

  it("on a pathname change, focuses the page h1 inside #main without scrolling, making it focusable", () => {
    const { h1 } = page(true);
    const { rerender } = mount("/");
    rerender({ path: "/members" });
    expect(document.activeElement).toBe(h1);
    expect(h1!.getAttribute("tabindex")).toBe("-1");
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("falls back to #main when the page has no h1", () => {
    const { main } = page(false);
    const { rerender } = mount("/");
    rerender({ path: "/join" });
    expect(document.activeElement).toBe(main);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("ignores h1s outside #main", () => {
    document.body.innerHTML = `<h1>Outside</h1><main id="main" tabindex="-1"></main>`;
    const { rerender } = mount("/");
    rerender({ path: "/join" });
    expect(document.activeElement).toBe(document.getElementById("main"));
  });

  it("leaves focus alone when the URL has a hash (the browser scrolls to it)", () => {
    page(true);
    const { rerender } = mount("/members");
    window.history.replaceState(null, "", "/#mission");
    rerender({ path: "/" });
    expect(focus).not.toHaveBeenCalled();
  });

  it("does nothing when the pathname is unchanged, or when the page has no #main", () => {
    page(true);
    const { rerender } = mount("/");
    rerender({ path: "/" });
    expect(focus).not.toHaveBeenCalled();
    document.body.innerHTML = "<h1>No main</h1>";
    rerender({ path: "/auth" });
    expect(focus).not.toHaveBeenCalled();
  });

  it("waits for the page h1 when the new page renders it late (loading states), then focuses it", async () => {
    document.body.innerHTML = `<main id="main" tabindex="-1"><span role="status"></span></main>`;
    const { rerender } = mount("/");
    rerender({ path: "/account" });
    expect(document.activeElement).toBe(document.getElementById("main"));
    document.getElementById("main")!.innerHTML = "<h1>Your profile</h1>";
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement).toBe(document.querySelector("h1"));
  });

  it("waits for #main itself when it isn't in the DOM yet", async () => {
    document.body.innerHTML = "";
    const { rerender } = mount("/");
    rerender({ path: "/account" });
    document.body.innerHTML = `<main id="main" tabindex="-1"><h1>Late</h1></main>`;
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement).toBe(document.querySelector("h1"));
  });

  it("never steals focus the user has moved meanwhile", async () => {
    document.body.innerHTML = `<button>elsewhere</button><main id="main" tabindex="-1"></main>`;
    const { rerender } = mount("/");
    rerender({ path: "/account" });
    document.querySelector("button")!.focus();
    document.getElementById("main")!.innerHTML = "<h1>Late</h1>";
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement).toBe(document.querySelector("button"));
  });

  it("stops waiting on unmount", async () => {
    document.body.innerHTML = "";
    const { rerender, unmount } = mount("/");
    rerender({ path: "/account" });
    unmount();
    document.body.innerHTML = `<main id="main" tabindex="-1"><h1>Late</h1></main>`;
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement).toBe(document.body);
  });

  it("the app stylesheet hides the outline on the programmatically focused heading", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(`${process.cwd()}/src/styles.css`, "utf8")).toMatch(/#main \[tabindex="-1"\]:focus\s*\{\s*outline:\s*none/);
  });
});
