// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";

const router = vi.hoisted(() => ({ invalidate: vi.fn(() => Promise.resolve()) }));
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<object>()),
  ...(await import("@/test/dom")).routerStubs,
  useRouter: () => router,
}));

import { ErrorPage, NotFound } from "@/app/layout/StatusPages";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  router.invalidate.mockClear();
});

describe("NotFound", () => {
  it("renders a link home", () => {
    renderWithQueries(<NotFound />);
    expect(screen.getByRole("heading", { level: 2 })).toBeTruthy();
    expect(screen.getByRole("link", { name: /back to home/i }).getAttribute("href")).toBe("/");
  });
});

describe("ErrorPage", () => {
  const boom = new Error("relation \"profiles\" does not exist");

  it("Try again resets the boundary and invalidates the router", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reset = vi.fn();
    renderWithQueries(<ErrorPage error={boom} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(router.invalidate).toHaveBeenCalledTimes(1);
  });

  it("shows a generic message and a link home, never the raw error, and logs it", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { container } = renderWithQueries(<ErrorPage error={boom} reset={() => undefined} />);
    expect(container.textContent).not.toContain(boom.message);
    expect(screen.getByRole("link", { name: /back to home/i }).getAttribute("href")).toBe("/");
    expect(log).toHaveBeenCalledWith(expect.any(String), boom);
  });
});

describe("status pages landmarks", () => {
  const pages: [string, () => React.ReactElement][] = [
    ["NotFound", () => <NotFound />],
    ["ErrorPage", () => <ErrorPage error={new Error("x")} reset={() => undefined} />],
  ];
  for (const [name, ui] of pages) {
    it(`${name} starts with a skip link and wraps its content in one <main id="main">`, () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { container } = renderWithQueries(ui());
      const mains = screen.getAllByRole("main");
      expect(mains).toHaveLength(1);
      expect(mains[0].id).toBe("main");
      expect(mains[0].tabIndex).toBe(-1);
      expect(container.querySelector("a")!.getAttribute("href")).toBe("#main");
      expect(mains[0].querySelector("header")).toBeNull();
      expect(mains[0].contains(screen.getByRole("link", { name: /back to home/i }))).toBe(true);
    });
  }
});
