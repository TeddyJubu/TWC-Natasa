// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { CurvedLoop } from "./curved-loop";

type SvgWithLength = SVGElement & { getComputedTextLength?: () => number };
const svgProto = SVGElement.prototype as SvgWithLength;

let textLength: number;
let measure: ReturnType<typeof vi.fn>;
let observers: { cb: IntersectionObserverCallback; disconnect: ReturnType<typeof vi.fn> }[];
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

function stubFonts(ready: Promise<unknown> | undefined) {
  Object.defineProperty(document, "fonts", { configurable: true, value: ready ? { ready } : undefined });
}

beforeEach(() => {
  textLength = 100;
  measure = vi.fn(() => textLength);
  svgProto.getComputedTextLength = measure as unknown as () => number;
  observers = [];
  frames = new Map();
  nextFrame = 1;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("IntersectionObserver", class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    constructor(public cb: IntersectionObserverCallback) { observers.push(this); }
  });
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { const id = nextFrame++; frames.set(id, cb); return id; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id); });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete svgProto.getComputedTextLength;
  Reflect.deleteProperty(document, "fonts");
});

const report = (isIntersecting: boolean) => {
  const io = observers[observers.length - 1];
  act(() => io.cb([{ isIntersecting } as IntersectionObserverEntry], io as unknown as IntersectionObserver));
};

describe("CurvedLoop animation loop", () => {
  it("runs no frames while off-screen and restarts when visible", () => {
    stubFonts(undefined);
    render(<CurvedLoop marqueeText="Hello" />);
    expect(observers).toHaveLength(1);
    report(true);
    expect(frames.size).toBe(1);
    report(false);
    expect(frames.size).toBe(0);
    report(true);
    expect(frames.size).toBe(1);
  });
});

/** Runs every pending animation frame at timestamp `ts` (ms). */
const tick = (ts: number) => {
  const pending = [...frames.values()];
  frames.clear();
  act(() => {
    for (const cb of pending) cb(ts);
  });
};

/** Ticks frames every `step` ms over [from, to]. */
const run = (from: number, to: number, step = 50) => {
  for (let t = from; t <= to; t += step) tick(t);
};

const offsetOf = (container: HTMLElement) => container.querySelector("textPath")?.getAttribute("startOffset");

describe("CurvedLoop auto-stop (WCAG 2.2.2)", () => {
  it("advances while it has run for less than 5 seconds", () => {
    stubFonts(undefined);
    const { container } = render(<CurvedLoop marqueeText="Hello" />);
    report(true);
    run(0, 4000);
    const before = offsetOf(container);
    tick(4050);
    expect(offsetOf(container)).not.toBe(before);
    expect(frames.size).toBe(1);
  });

  it("stops scheduling frames and rests after 5 seconds of running", () => {
    stubFonts(undefined);
    const { container } = render(<CurvedLoop marqueeText="Hello" />);
    report(true);
    run(0, 5100);
    expect(frames.size).toBe(0);
    const rested = offsetOf(container);
    run(5150, 6000);
    expect(offsetOf(container)).toBe(rested);
  });

  it("does not count time spent off-screen toward the 5 seconds", () => {
    stubFonts(undefined);
    const { container } = render(<CurvedLoop marqueeText="Hello" />);
    report(true);
    run(0, 3000);
    report(false);
    report(true);
    // A long off-screen gap, then ~1.9 s more on screen: 4.9 s in total, still running.
    run(100_000, 101_900);
    expect(frames.size).toBe(1);
    const before = offsetOf(container);
    tick(101_950);
    expect(offsetOf(container)).not.toBe(before);
    // Crossing 5 s of on-screen time stops it.
    run(102_000, 102_300);
    expect(frames.size).toBe(0);
  });

  it("counts at most 100 ms for one long frame gap (a throttled tab)", () => {
    stubFonts(undefined);
    render(<CurvedLoop marqueeText="Hello" />);
    report(true);
    tick(0);
    tick(60_000);
    expect(frames.size).toBe(1);
  });

  it("keeps its budget when re-rendered with a new speed", () => {
    stubFonts(undefined);
    const { rerender } = render(<CurvedLoop marqueeText="Hello" speed={0.2} />);
    report(true);
    run(0, 3000);
    rerender(<CurvedLoop marqueeText="Hello" speed={0.4} />);
    report(true);
    run(10_000, 11_900);
    expect(frames.size).toBe(1);
    run(11_950, 12_300);
    expect(frames.size).toBe(0);
  });

  it("does not restart when it becomes visible again after stopping", () => {
    stubFonts(undefined);
    const { container } = render(<CurvedLoop marqueeText="Hello" />);
    report(true);
    run(0, 5100);
    expect(frames.size).toBe(0);
    const rested = offsetOf(container);
    report(false);
    report(true);
    expect(frames.size).toBe(0);
    run(20_000, 21_000);
    expect(offsetOf(container)).toBe(rested);
  });
});

describe("CurvedLoop font measurement", () => {
  it("re-measures the text once web fonts are ready", async () => {
    let fontsLoaded!: () => void;
    stubFonts(new Promise<void>((resolve) => { fontsLoaded = resolve; }));
    const { container } = render(<CurvedLoop marqueeText="Hello" />);
    expect(container.querySelector("textPath")?.getAttribute("startOffset")).toBe("-100px");

    textLength = 150;
    await act(async () => { fontsLoaded(); });
    expect(container.querySelector("textPath")?.getAttribute("startOffset")).toBe("-150px");
  });

  it("renders without document.fonts", () => {
    stubFonts(undefined);
    expect(() => render(<CurvedLoop marqueeText="Hello" />)).not.toThrow();
  });

  it("does not measure after unmount", async () => {
    let fontsLoaded!: () => void;
    stubFonts(new Promise<void>((resolve) => { fontsLoaded = resolve; }));
    const { unmount } = render(<CurvedLoop marqueeText="Hello" />);
    const calls = measure.mock.calls.length;
    unmount();
    await act(async () => { fontsLoaded(); });
    expect(measure.mock.calls.length).toBe(calls);
  });
});
