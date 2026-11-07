// @vitest-environment jsdom
import * as React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { ImageTrail } from "./image-trail";

/** matchMedia that answers the trail's two queries from the given device traits. */
function stubDevice({ finePointer, reducedMotion }: { finePointer: boolean; reducedMotion: boolean }) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotion : query.includes("pointer: fine") ? finePointer : false,
    media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ImageTrail", () => {
  it("emits no images in server markup", () => {
    const html = renderToString(<ImageTrail />);
    expect(html).not.toContain("<img");
  });

  it("renders no images for a coarse pointer", async () => {
    stubDevice({ finePointer: false, reducedMotion: false });
    render(<ImageTrail />);
    await act(async () => {});
    expect(document.querySelectorAll("img")).toHaveLength(0);
  });

  it("renders no images when reduced motion is requested", async () => {
    stubDevice({ finePointer: true, reducedMotion: true });
    render(<ImageTrail />);
    await act(async () => {});
    expect(document.querySelectorAll("img")).toHaveLength(0);
  });

  it("renders 96px WebP flowers on the client for a fine, hovering pointer", async () => {
    stubDevice({ finePointer: true, reducedMotion: false });
    render(<ImageTrail count={6} />);
    await act(async () => {});
    const images = Array.from(document.querySelectorAll("img"));
    expect(images).toHaveLength(6);
    for (const img of images) {
      expect(img.getAttribute("width")).toBe("96");
      expect(img.getAttribute("height")).toBe("96");
      expect(img.getAttribute("src")).toMatch(/\.webp$/);
    }
  });

  it("portals to <body>, so a transformed ancestor (the route-in animation) never becomes its containing block", async () => {
    stubDevice({ finePointer: true, reducedMotion: false });
    render(<div style={{ transform: "translateY(8px)" }} data-testid="route"><ImageTrail count={2} /></div>);
    await act(async () => {});
    const trail = document.querySelector(".image-trail")!;
    expect(trail.parentElement).toBe(document.body);
  });
});
