// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Footer, Navbar, SectionHeader, type NavbarProps, type RouterLinkComponent } from "./layout";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});

const links = [
  { label: "Members", href: "/members" },
  { label: "Mission", href: "/#mission" },
  { label: "Top", href: "#top" },
  { label: "Email", href: "mailto:hi@example.com" },
  { label: "Elsewhere", href: "https://example.com/" },
  { label: "Protocol relative", href: "//cdn.example.com/x" },
];

/** A fake router link that records every href it is asked to render. */
function recordingLink() {
  const seen: string[] = [];
  const Link: RouterLinkComponent = ({ href, className, children, onClick }) => {
    seen.push(href);
    return <a href={href} className={className} onClick={onClick} data-router="">{children}</a>;
  };
  return { Link, seen };
}

const routed = (name: string) => screen.getByRole("link", { name }).hasAttribute("data-router");

describe("SectionHeader", () => {
  it("renders its title as an h2, or as the page h1 when asked", () => {
    render(<><SectionHeader headingAs="h1" badge="Privacy" title="Page" /><SectionHeader title="Section" /></>);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Page");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Section");
  });
});

describe("linkComponent", () => {
  it("Navbar routes internal hrefs through it and leaves hash, mailto and external links plain", () => {
    const { Link, seen } = recordingLink();
    render(<Navbar brand="Brand" links={links} linkComponent={Link} />);
    expect(new Set(seen)).toEqual(new Set(["/members", "/#mission"]));
    expect(routed("Members")).toBe(true);
    expect(routed("Mission")).toBe(true);
    for (const name of ["Top", "Email", "Elsewhere", "Protocol relative"]) expect(routed(name)).toBe(false);
    expect(screen.getByRole("link", { name: "Top" }).getAttribute("href")).toBe("#top");
  });

  it("Footer routes internal link and contact hrefs through it and leaves the rest plain", () => {
    const { Link, seen } = recordingLink();
    render(
      <Footer
        links={links}
        contacts={[{ label: "Write", value: "hi@example.com", href: "mailto:hi@example.com" }, { label: "Visit", value: "Apply", href: "/join" }]}
        linkComponent={Link}
      />,
    );
    expect(new Set(seen)).toEqual(new Set(["/members", "/#mission", "/join"]));
    expect(routed("Apply")).toBe(true);
    expect(routed("hi@example.com")).toBe(false);
    for (const name of ["Top", "Email", "Elsewhere", "Protocol relative"]) expect(routed(name)).toBe(false);
  });

  it("without it, every link stays a plain anchor", () => {
    render(<><Navbar brand="Brand" links={links} /><Footer links={links} /></>);
    for (const a of screen.getAllByRole("link")) expect(a.hasAttribute("data-router")).toBe(false);
    expect(screen.getAllByRole("link", { name: "Members" })[0].getAttribute("href")).toBe("/members");
  });
});

const menuButton = () => screen.getByRole("button", { name: "Menu" });
// The panel stays mounted (hidden) so aria-controls always points at a real element.
const panel = () => document.getElementById(menuButton().getAttribute("aria-controls") ?? "");
const closed = () => menuButton().getAttribute("aria-expanded") === "false" && panel()!.hidden;
/** jsdom does not implement document navigation: swallow link clicks after React has seen them. */
const clickWithoutNavigating = (el: Element) => {
  const stay = (e: Event) => e.preventDefault();
  document.addEventListener("click", stay);
  fireEvent.click(el);
  document.removeEventListener("click", stay);
};

describe.each<NonNullable<NavbarProps["variant"]>>(["solid", "hero", "overlay"])("mobile menu (%s)", (variant) => {
  const setup = () => render(<Navbar variant={variant} brand="Brand" links={links.slice(0, 3)} />);

  it("is a collapsed disclosure button hidden from md up", () => {
    setup();
    const button = menuButton();
    expect(button.className.split(" ")).toContain("md:hidden");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBeTruthy();
    expect(panel()).not.toBeNull();
    expect(closed()).toBe(true);
  });

  it("opens a panel with the same links and moves focus to the first", () => {
    setup();
    fireEvent.click(menuButton());
    expect(menuButton().getAttribute("aria-expanded")).toBe("true");
    const el = panel();
    expect(el!.hidden).toBe(false);
    const panelLinks = Array.from(el!.querySelectorAll("a"));
    expect(panelLinks.map((a) => [a.textContent, a.getAttribute("href")])).toEqual(links.slice(0, 3).map((l) => [l.label, l.href]));
    expect(document.activeElement).toBe(panelLinks[0]);
    expect(el!.className).toContain("motion-panel-in");
    expect(el!.className).toContain("motion-reduce:animate-none");
  });

  it("closes on Escape and returns focus to the button", () => {
    setup();
    fireEvent.click(menuButton());
    fireEvent.keyDown(document.activeElement ?? document, { key: "Escape" });
    expect(closed()).toBe(true);
    expect(document.activeElement).toBe(menuButton());
  });

  it("ignores an Escape that another widget already handled", () => {
    setup();
    fireEvent.click(menuButton());
    const handled = (e: KeyboardEvent) => e.preventDefault();
    document.addEventListener("keydown", handled, { capture: true });
    fireEvent.keyDown(document.activeElement ?? document, { key: "Escape" });
    document.removeEventListener("keydown", handled, { capture: true });
    expect(menuButton().getAttribute("aria-expanded")).toBe("true");
  });

  it("closes when a panel link is clicked", () => {
    setup();
    fireEvent.click(menuButton());
    clickWithoutNavigating(panel()!.querySelector("a")!);
    expect(closed()).toBe(true);
  });

  it("closes when any other link in the bar (brand, action) is clicked", () => {
    render(<Navbar variant={variant} brand={<a href="/">Home</a>} links={links.slice(0, 2)} action={<a href="/join">Join</a>} />);
    for (const name of ["Home", "Join"]) {
      fireEvent.click(menuButton());
      clickWithoutNavigating(screen.getByRole("link", { name }));
      expect(closed()).toBe(true);
    }
  });

  it("closes on back/forward and hash navigation", () => {
    setup();
    for (const type of ["popstate", "hashchange"]) {
      fireEvent.click(menuButton());
      act(() => void window.dispatchEvent(new Event(type)));
      expect(closed()).toBe(true);
    }
  });

  it("closes when the viewport widens past md, so the scroll lock never outlives the hidden panel", () => {
    const listeners = new Set<(e: { matches: boolean }) => void>();
    vi.stubGlobal("matchMedia", (media: string) => ({
      media, matches: false,
      addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.delete(fn),
    }));
    setup();
    fireEvent.click(menuButton());
    act(() => listeners.forEach((fn) => fn({ matches: true })));
    expect(closed()).toBe(true);
    expect(document.body.style.overflow).toBe("");
  });

  it("locks body scroll while open and restores the previous overflow on close", () => {
    document.body.style.overflow = "scroll";
    setup();
    fireEvent.click(menuButton());
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(menuButton());
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("restores the previous overflow on unmount", () => {
    document.body.style.overflow = "auto";
    const { unmount } = setup();
    fireEvent.click(menuButton());
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });
});

describe("mobile menu: names, inert background, outside close and focus", () => {
  const page = () => (
    <div data-testid="page">
      <a href="#main" data-testid="skip">Skip</a>
      <Navbar brand="Brand" links={links.slice(0, 3)} />
      <main data-testid="main">Content</main>
      <footer data-testid="footer">Footer</footer>
    </div>
  );
  const inert = (id: string) => screen.getByTestId(id).hasAttribute("inert");

  it("the toggle and the panel nav have distinct accessible names", () => {
    render(<Navbar brand="Brand" links={links.slice(0, 3)} />);
    expect(menuButton()).toBeTruthy();
    const panelNav = panel()!.querySelector("nav")!;
    expect(panelNav.getAttribute("aria-label")).toBe("Main");
    expect(screen.queryByRole("navigation", { name: "Menu" })).toBeNull();
  });

  it("makes every sibling up to <body> inert while open, and only undoes its own", () => {
    const already = document.createElement("div");
    already.setAttribute("inert", "");
    const outside = document.createElement("aside");
    document.body.append(already, outside);
    try {
      render(page());
      expect(inert("main")).toBe(false);
      fireEvent.click(menuButton());
      for (const id of ["skip", "main", "footer"]) expect(inert(id)).toBe(true);
      expect(outside.hasAttribute("inert")).toBe(true);
      expect(document.querySelector("header")!.hasAttribute("inert")).toBe(false);
      expect(inert("page")).toBe(false);
      fireEvent.click(menuButton());
      for (const id of ["skip", "main", "footer"]) expect(inert(id)).toBe(false);
      expect(outside.hasAttribute("inert")).toBe(false);
      expect(already.hasAttribute("inert")).toBe(true);
    } finally {
      already.remove();
      outside.remove();
    }
  });

  it("clears the inert background on unmount", () => {
    const { unmount } = render(page());
    const main = screen.getByTestId("main");
    fireEvent.click(menuButton());
    expect(main.hasAttribute("inert")).toBe(true);
    unmount();
    expect(main.hasAttribute("inert")).toBe(false);
  });

  it("closes on a pointerdown outside the header, not inside it", () => {
    render(page());
    fireEvent.click(menuButton());
    fireEvent.pointerDown(panel()!.querySelector("a")!);
    expect(menuButton().getAttribute("aria-expanded")).toBe("true");
    fireEvent.pointerDown(screen.getByTestId("main"));
    expect(closed()).toBe(true);
  });

  it("after a panel link click, focus moves to the toggle (never lost to body), without scrolling", () => {
    render(page());
    fireEvent.click(menuButton());
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    clickWithoutNavigating(panel()!.querySelector("a")!);
    expect(closed()).toBe(true);
    expect(document.activeElement).toBe(menuButton());
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    focus.mockRestore();
  });
});

describe("hide on scroll", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 0 });
  });

  const scrollTo = (y: number) =>
    act(() => {
      (window as { scrollY: number }).scrollY = y;
      window.dispatchEvent(new Event("scroll"));
    });
  const header = () => document.querySelector("header")!;

  it("hides the bar on a scroll down past the top when the menu is closed", () => {
    render(<Navbar brand="Brand" links={links.slice(0, 2)} />);
    scrollTo(200);
    expect(header().className.split(" ")).toContain("-translate-y-full");
  });

  it("after a menu link click (an in-page hash, no navigation), hides again on the next scroll down", () => {
    render(<Navbar brand="Brand" links={links.slice(0, 2)} />);
    fireEvent.click(menuButton());
    const panel = document.getElementById(menuButton().getAttribute("aria-controls")!)!;
    fireEvent.click(within(panel).getByRole("link", { name: "Mission" }));
    expect(document.activeElement).toBe(menuButton());
    scrollTo(200);
    expect(header().className.split(" ")).toContain("-translate-y-full");
  });

  it("never hides the bar while the menu is open, even after focus leaves it", () => {
    render(<Navbar brand="Brand" links={links.slice(0, 2)} />);
    fireEvent.click(menuButton());
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    expect(header().contains(document.activeElement)).toBe(false);
    scrollTo(200);
    expect(header().className.split(" ")).not.toContain("-translate-y-full");
  });
});
