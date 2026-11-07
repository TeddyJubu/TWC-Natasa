// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { ProximityText } from "./proximity-text";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ProximityText", () => {
  it("reads every letter's rect before writing any transform", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("hover: hover"), media: query, addEventListener() {}, removeEventListener() {} }));
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});

    const { container } = render(<ProximityText text="Hi you" radius={1000} />);
    const letters = Array.from(container.querySelectorAll<HTMLSpanElement>("[data-letter]"));
    expect(letters.length).toBe(5);

    const log: string[] = [];
    letters.forEach((el, i) => {
      el.getBoundingClientRect = () => {
        log.push(`read ${i}`);
        return { left: i * 10, top: 0, width: 10, height: 10, right: i * 10 + 10, bottom: 10, x: i * 10, y: 0, toJSON() {} } as DOMRect;
      };
      let value = "";
      Object.defineProperty(el.style, "transform", {
        configurable: true,
        get: () => value,
        set: (v: string) => { log.push(`write ${i}`); value = v; },
      });
    });

    const root = container.firstElementChild as HTMLElement;
    act(() => {
      root.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: 20, clientY: 5 }));
    });
    act(() => frames.splice(0).forEach((f) => f(0)));

    const firstWrite = log.findIndex((entry) => entry.startsWith("write"));
    expect(firstWrite).toBe(letters.length);
    expect(log.slice(0, firstWrite).every((entry) => entry.startsWith("read"))).toBe(true);
    expect(log.slice(firstWrite).every((entry) => entry.startsWith("write"))).toBe(true);
    expect(log.filter((entry) => entry.startsWith("write"))).toHaveLength(letters.length);
  });

  it("does not promote every letter to its own layer", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
    const { container } = render(<ProximityText text="Hello" />);
    for (const el of container.querySelectorAll("[data-letter]")) {
      expect(el.className).not.toContain("will-change-transform");
    }
  });
});
