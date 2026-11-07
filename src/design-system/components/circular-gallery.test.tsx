// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

// Minimal stand-ins for the ogl classes the engine touches; WebGL can't run in jsdom.
const ogl = vi.hoisted(() => {
  const state = {
    renderers: [] as unknown[],
    gl: undefined as unknown as Record<string, ReturnType<typeof vi.fn>> & { canvas: HTMLCanvasElement },
    textures: [] as { texture: object }[],
    loseContext: vi.fn(),
  };
  const vec = () => ({ x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } });
  class Renderer {
    gl: typeof state.gl;
    constructor() {
      const loseContext = state.loseContext;
      this.gl = {
        canvas: document.createElement("canvas"),
        clearColor: vi.fn(),
        deleteTexture: vi.fn(),
        getExtension: vi.fn((name: string) => (name === "WEBGL_lose_context" ? { loseContext } : null)),
      } as unknown as typeof state.gl;
      state.gl = this.gl;
      state.renderers.push(this);
    }
    setSize() {}
    render() {}
  }
  class Camera {
    fov = 45;
    aspect = 1;
    position = vec();
    perspective({ aspect }: { aspect: number }) { this.aspect = aspect; }
  }
  class Transform {}
  class Plane {}
  class Texture {
    texture = {};
    image: unknown;
    constructor() { state.textures.push(this); }
  }
  class Program {
    uniforms: Record<string, { value: unknown }>;
    constructor(_gl: unknown, { uniforms }: { uniforms: Record<string, { value: unknown }> }) { this.uniforms = uniforms; }
  }
  class Mesh {
    program: Program;
    position = vec();
    rotation = vec();
    scale = vec();
    constructor(_gl: unknown, { program }: { program: Program }) { this.program = program; }
    setParent() {}
  }
  return { state, module: { Renderer, Camera, Transform, Plane, Texture, Program, Mesh } };
});
vi.mock("ogl", () => ogl.module);

import { CircularGalleryEngine } from "./circular-gallery";

const INPUT = /^(wheel|mousewheel|pointer|mouse|touch)/;
type Listener = { target: EventTarget; type: string; fn: EventListenerOrEventListenerObject };

let added: Listener[];
let removed: Listener[];
let observers: { observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; cb: IntersectionObserverCallback }[];
let rafCallbacks: Map<number, FrameRequestCallback>;
let nextRaf: number;

beforeEach(() => {
  ogl.state.renderers = [];
  ogl.state.textures = [];
  ogl.state.loseContext.mockClear();
  added = [];
  removed = [];
  observers = [];
  rafCallbacks = new Map();
  nextRaf = 1;

  // Spy on window itself too: under vitest's jsdom env its methods don't route through EventTarget.prototype.
  for (const owner of [EventTarget.prototype, window] as EventTarget[]) {
    const realAdd = owner.addEventListener;
    const realRemove = owner.removeEventListener;
    const targetOf = (self: EventTarget) => (owner === window ? window : self);
    vi.spyOn(owner, "addEventListener").mockImplementation(function (this: EventTarget, type, fn, opts) {
      if (fn) added.push({ target: targetOf(this), type, fn });
      return realAdd.call(this, type, fn, opts);
    });
    vi.spyOn(owner, "removeEventListener").mockImplementation(function (this: EventTarget, type, fn, opts) {
      if (fn) removed.push({ target: targetOf(this), type, fn });
      return realRemove.call(this, type, fn, opts);
    });
  }

  vi.stubGlobal("IntersectionObserver", class {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    constructor(public cb: IntersectionObserverCallback) { observers.push(this); }
  });
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { const id = nextRaf++; rafCallbacks.set(id, cb); return id; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => { rafCallbacks.delete(id); });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({
    font: "", fillStyle: "", textBaseline: "", textAlign: "",
    measureText: () => ({ width: 40 }), clearRect() {}, fillText() {},
  }) as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const items = () => [
  { image: "/a.jpg", text: "A" },
  { image: "/b.jpg", text: "B" },
];

/**
 * Mounts the engine and waits for its async font resolution so the App exists.
 * `engineListeners` are those added after React's own root setup, i.e. by the engine.
 */
async function mount(list = items()) {
  const utils = render(<CircularGalleryEngine items={list} data-testid="gallery" />);
  const before = added.length;
  await act(async () => {});
  const container = utils.getByTestId("gallery");
  return { ...utils, container, engineListeners: () => added.slice(before) };
}

describe("CircularGalleryEngine input listeners", () => {
  it("listens for wheel, pointer, mouse and touch input on its container, never on window", async () => {
    const { container, engineListeners } = await mount();
    expect(ogl.state.renderers).toHaveLength(1);
    const onWindow = engineListeners().filter((l) => l.target === window).map((l) => l.type);
    expect(onWindow.filter((t) => INPUT.test(t))).toEqual([]);
    expect(onWindow).toContain("resize");
    const onContainer = engineListeners().filter((l) => l.target === container).map((l) => l.type);
    expect(onContainer).toEqual(expect.arrayContaining(["wheel", "mousedown", "mousemove", "mouseup", "touchstart", "touchmove", "touchend", "touchcancel", "keydown"]));
    expect(engineListeners().map((l) => l.type)).not.toContain("mousewheel");
  });
});

describe("CircularGalleryEngine animation loop", () => {
  it("pauses while off-screen and resumes when visible again", async () => {
    await mount();
    expect(rafCallbacks.size).toBe(1);
    const io = observers[0];
    expect(io).toBeDefined();
    act(() => io.cb([{ isIntersecting: false } as IntersectionObserverEntry], io as unknown as IntersectionObserver));
    expect(rafCallbacks.size).toBe(0);
    act(() => io.cb([{ isIntersecting: true } as IntersectionObserverEntry], io as unknown as IntersectionObserver));
    expect(rafCallbacks.size).toBe(1);
  });

  it("pauses while the tab is hidden and resumes when it is shown", async () => {
    await mount();
    let hidden = true;
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(rafCallbacks.size).toBe(0);
    hidden = false;
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(rafCallbacks.size).toBe(1);
  });
});

describe("CircularGalleryEngine cleanup", () => {
  it("removes every listener, observer, frame, texture, context and canvas on unmount", async () => {
    const { container, unmount, engineListeners } = await mount();
    const canvas = ogl.state.gl.canvas;
    expect(container.contains(canvas)).toBe(true);
    const listeners = engineListeners();
    expect(listeners.length).toBeGreaterThan(0);

    unmount();

    for (const l of listeners) {
      expect(removed.some((r) => r.target === l.target && r.type === l.type && r.fn === l.fn), `${l.type} removed`).toBe(true);
    }
    expect(observers.every((o) => o.disconnect.mock.calls.length > 0)).toBe(true);
    expect(rafCallbacks.size).toBe(0);
    const deleted = ogl.state.gl.deleteTexture.mock.calls.map(([t]) => t);
    expect(ogl.state.textures.length).toBeGreaterThan(0);
    for (const tex of ogl.state.textures) expect(deleted).toContain(tex.texture);
    expect(ogl.state.gl.getExtension).toHaveBeenCalledWith("WEBGL_lose_context");
    expect(ogl.state.loseContext).toHaveBeenCalled();
    expect(canvas.isConnected).toBe(false);
  });
});

describe("CircularGalleryEngine identity", () => {
  it("does not rebuild when re-rendered with an equal new items array", async () => {
    const { rerender } = await mount();
    rerender(<CircularGalleryEngine items={items()} data-testid="gallery" />);
    await act(async () => {});
    expect(ogl.state.renderers).toHaveLength(1);
  });

  it("rebuilds when the items actually change", async () => {
    const { rerender } = await mount();
    rerender(<CircularGalleryEngine items={[...items(), { image: "/c.jpg", text: "C" }]} data-testid="gallery" />);
    await act(async () => {});
    expect(ogl.state.renderers).toHaveLength(2);
  });
});
