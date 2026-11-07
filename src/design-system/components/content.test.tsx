// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Accordion, CurvedGallery, Ribbon, Tabs } from "./content";

// The WebGL engine can't run in jsdom; the gallery only decides when to mount it.
vi.mock("./circular-gallery", () => ({ CircularGalleryEngine: () => <div data-testid="engine" /> }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const classes = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/);
const FOCUS_RING = ["focus-visible:ring-2", "focus-visible:ring-ring", "focus-visible:ring-offset-2", "focus-visible:ring-offset-canvas"];

describe("Ribbon", () => {
  const text = "Astoria · Sunnyside";

  it("announces the text once: one sr-only copy, the visual copies hidden", () => {
    const { container } = render(<Ribbon text={text} />);
    const copies = [...container.querySelectorAll("span")].filter((s) => s.textContent === text && s.children.length === 0);
    const announced = copies.filter((s) => !s.closest("[aria-hidden='true']"));
    expect(announced).toHaveLength(1);
    expect(classes(announced[0])).toContain("sr-only");
    expect(copies.length).toBeGreaterThan(1);
  });

  it("pauses on hover", () => {
    const { container } = render(<Ribbon text={text} />);
    const track = container.querySelector(".animate-marquee")!;
    expect(classes(track)).toContain("group-hover:[animation-play-state:paused]");
    expect(classes(track.parentElement!)).toContain("group");
  });

  it("has a pause toggle, visually hidden until focused, that pauses the marquee", () => {
    const { container } = render(<Ribbon text={text} />);
    const button = screen.getByRole("button", { name: "Pause ribbon" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(classes(button)).toContain("sr-only");
    expect(classes(button)).toContain("focus:not-sr-only");
    const track = container.querySelector(".animate-marquee")!;
    expect(classes(track)).not.toContain("[animation-play-state:paused]");
    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(classes(track)).toContain("[animation-play-state:paused]");
    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(classes(track)).not.toContain("[animation-play-state:paused]");
  });
});

describe("CurvedGallery", () => {
  const images = [{ src: "/a.jpg", alt: "Pia Lund" }, { src: "/b.jpg", alt: "Rosa Diaz" }];
  const motion = (reduce: boolean) =>
    vi.stubGlobal("matchMedia", (media: string) => ({ media, matches: reduce, addEventListener() {}, removeEventListener() {} }));

  it("with motion, renders the WebGL engine plus one sr-only list of the images", () => {
    motion(false);
    render(<CurvedGallery images={images} />);
    expect(screen.getByTestId("engine")).toBeTruthy();
    expect(screen.getAllByRole("img").map((i) => i.getAttribute("alt"))).toEqual(["Pia Lund", "Rosa Diaz"]);
  });

  it("with reduced motion, announces each image once (no extra sr-only list)", () => {
    motion(true);
    render(<CurvedGallery images={images} />);
    expect(screen.queryByTestId("engine")).toBeNull();
    expect(screen.getAllByRole("img").map((i) => i.getAttribute("alt"))).toEqual(["Pia Lund", "Rosa Diaz"]);
  });
});

describe("Tabs", () => {
  const items = [
    { label: "One", content: <p>First panel</p> },
    { label: "Two", content: <p>Second panel</p> },
    { label: "Three", content: <p>Third panel</p> },
  ];
  const tab = (name: string) => screen.getByRole("tab", { name });

  it("renders a panel for every tab, so each aria-controls target exists", () => {
    render(<Tabs items={items} />);
    for (const t of screen.getAllByRole("tab")) {
      const panel = document.getElementById(t.getAttribute("aria-controls") ?? "");
      expect(panel).not.toBeNull();
      expect(panel!.getAttribute("role")).toBe("tabpanel");
      expect(panel!.getAttribute("aria-labelledby")).toBe(t.id);
    }
    const panels = document.querySelectorAll("[role=tabpanel]");
    expect([...panels].map((p) => (p as HTMLElement).hidden)).toEqual([false, true, true]);
    expect(screen.getByRole("tabpanel", { name: "One" }).textContent).toBe("First panel");
    expect(classes(screen.getByRole("tabpanel", { name: "One" }))).toContain("motion-panel-in");
  });

  it("uses a roving tabindex", () => {
    render(<Tabs items={items} defaultIndex={1} />);
    expect(screen.getAllByRole("tab").map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
    fireEvent.click(tab("Three"));
    expect(screen.getAllByRole("tab").map((t) => t.tabIndex)).toEqual([-1, -1, 0]);
    expect(screen.getByRole("tabpanel", { name: "Three" }).textContent).toBe("Third panel");
  });

  it("ArrowRight/ArrowLeft (wrapping), Home and End move focus and select", () => {
    render(<Tabs items={items} />);
    const press = (key: string) => fireEvent.keyDown(document.activeElement!, { key });
    tab("One").focus();
    const expectSelected = (name: string) => {
      expect(document.activeElement).toBe(tab(name));
      expect(tab(name).getAttribute("aria-selected")).toBe("true");
      expect(within(screen.getByRole("tabpanel", { name })).getByText(/panel/)).toBeTruthy();
    };
    press("ArrowRight");
    expectSelected("Two");
    press("ArrowRight");
    expectSelected("Three");
    press("ArrowRight");
    expectSelected("One");
    press("ArrowLeft");
    expectSelected("Three");
    press("Home");
    expectSelected("One");
    press("End");
    expectSelected("Three");
  });

  it("leaves modified arrows (Alt+Left = back, Cmd+Arrow) to the browser", () => {
    render(<Tabs items={items} />);
    tab("One").focus();
    for (const mod of [{ altKey: true }, { metaKey: true }, { ctrlKey: true }]) {
      const notCancelled = fireEvent.keyDown(tab("One"), { key: "ArrowRight", ...mod });
      expect(notCancelled).toBe(true);
      expect(tab("One").getAttribute("aria-selected")).toBe("true");
    }
  });

  it("tab buttons show a visible focus ring like buttonVariants", () => {
    render(<Tabs items={items} />);
    for (const cls of FOCUS_RING) expect(classes(tab("One"))).toContain(cls);
  });
});

describe("Accordion", () => {
  it("summaries show a visible focus ring like buttonVariants", () => {
    const { container } = render(<Accordion items={[{ question: "Who?", answer: "Everyone." }]} />);
    const summary = container.querySelector("summary")!;
    for (const cls of FOCUS_RING) expect(classes(summary)).toContain(cls);
  });
});
