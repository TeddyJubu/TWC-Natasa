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
