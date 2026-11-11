// @vitest-environment jsdom
// resizeImage with a stubbed decoder and canvas (jsdom has neither): when it re-encodes, to what size and type, and
// that every failure hands back the file it was given.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FEED_RESIZE, fitWithin, LOGO_RESIZE, PORTRAIT_RESIZE, resizeImage } from "./resize-image";

const MB = 1024 * 1024;
const photo = (size: number, type = "image/jpeg", name = "IMG_0001.JPG") => new File([new Uint8Array(size)], name, { type });

let bitmap: { width: number; height: number; close: ReturnType<typeof vi.fn> };
let decode: ReturnType<typeof vi.fn>;
let writes: string[]; // the type the browser actually writes for each requested type
let canvases: { width: number; height: number; drawn: unknown[][]; encoded: [string, number | undefined][]; filled: boolean }[];

beforeEach(() => {
  bitmap = { width: 4032, height: 3024, close: vi.fn() };
  decode = vi.fn(async () => bitmap);
  vi.stubGlobal("createImageBitmap", decode);
  writes = ["image/webp", "image/png", "image/jpeg"];
  canvases = [];
  const create = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag !== "canvas") return create(tag);
    const c = { width: 0, height: 0, drawn: [] as unknown[][], encoded: [] as [string, number | undefined][], filled: false };
    canvases.push(c);
    const ctx = {
      imageSmoothingQuality: "low",
      globalCompositeOperation: "source-over",
      fillStyle: "",
      drawImage: (...args: unknown[]) => c.drawn.push(args),
      fillRect: () => { c.filled = true; },
    };
    return Object.assign(c, {
      getContext: () => ctx,
      toBlob: (done: (b: Blob | null) => void, type: string, quality?: number) => {
        c.encoded.push([type, quality]);
        // A browser that can't write a type writes PNG instead, as toBlob does.
        done(new Blob([new Uint8Array(1000)], { type: writes.includes(type) ? type : "image/png" }));
      },
    });
  }) as typeof document.createElement);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fitWithin", () => {
  it("scales the longest side down to the cap, keeping the shape, and never scales up", () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(10000, 3, 512)).toEqual({ width: 512, height: 1 }); // never 0
  });
});

describe("resizeImage", () => {
  it("decodes upright (Exif orientation applied) and writes a WebP at most maxEdge a side", async () => {
    const out = await resizeImage(photo(4 * MB), PORTRAIT_RESIZE);
    expect(decode).toHaveBeenCalledWith(expect.any(File), { imageOrientation: "from-image" });
    expect([canvases[0].width, canvases[0].height]).toEqual([1600, 1200]);
    expect(canvases[0].drawn[0]).toEqual([bitmap, 0, 0, 1600, 1200]);
    expect(canvases[0].encoded).toEqual([["image/webp", 0.82]]);
    expect([out.type, out.name, out.size]).toEqual(["image/webp", "IMG_0001.webp", 1000]);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it("uses the bitmap's upright size, so a portrait phone photo stays portrait", async () => {
    bitmap = { width: 3024, height: 4032, close: vi.fn() };
    await resizeImage(photo(4 * MB), FEED_RESIZE);
    expect([canvases[0].width, canvases[0].height]).toEqual([1536, 2048]);
  });

  it("falls back to JPEG on white where the browser can't write WebP", async () => {
    writes = ["image/png", "image/jpeg"];
    const out = await resizeImage(photo(4 * MB, "image/png", "scan.png"), PORTRAIT_RESIZE);
    expect(canvases[0].encoded).toEqual([["image/webp", 0.82], ["image/jpeg", 0.85]]);
    expect(canvases[0].filled).toBe(true);
    expect([out.type, out.name]).toEqual(["image/jpeg", "scan.jpg"]);
  });

  it("keeps a logo's transparency: WebP, else PNG, never JPEG", async () => {
    bitmap = { width: 2000, height: 1000, close: vi.fn() };
    const webp = await resizeImage(photo(3 * MB, "image/png", "logo.png"), LOGO_RESIZE);
    expect([canvases[0].width, canvases[0].height, webp.type]).toEqual([512, 256, "image/webp"]);
    writes = ["image/png", "image/jpeg"];
    const png = await resizeImage(photo(3 * MB, "image/png", "logo.png"), LOGO_RESIZE);
    expect(canvases[1].encoded.map(([t]) => t)).toEqual(["image/webp", "image/png"]);
    expect([png.type, png.name, canvases[1].filled]).toEqual(["image/png", "logo.png", false]);
  });

  it("leaves a file that is already small enough as it is", async () => {
    bitmap = { width: 800, height: 600, close: vi.fn() };
    const small = photo(200 * 1024);
    expect(await resizeImage(small, PORTRAIT_RESIZE)).toBe(small);
    expect(canvases).toEqual([]);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it("re-encodes a heavy file within the edge, but keeps the original if that only made it bigger", async () => {
    bitmap = { width: 1200, height: 900, close: vi.fn() };
    expect((await resizeImage(photo(3 * MB), PORTRAIT_RESIZE)).size).toBe(1000);
    const tight = photo(1001 * 1024);
    expect(await resizeImage(tight, { maxEdge: 1600, maxBytes: 1000 })).not.toBe(tight); // 1000 B beats ~1 MB
    const already = photo(900); // over its 500 B budget, but the 1000 B re-encode is larger
    expect(await resizeImage(already, { maxEdge: 1600, maxBytes: 500 })).toBe(already);
  });

  it("hands back the original when it can't help", async () => {
    const gif = photo(4 * MB, "image/gif", "a.gif");
    expect(await resizeImage(gif, PORTRAIT_RESIZE)).toBe(gif); // not a type we take: the caller refuses it
    const huge = photo(41 * MB);
    expect(await resizeImage(huge, PORTRAIT_RESIZE)).toBe(huge); // too big to decode safely
    decode.mockRejectedValueOnce(new DOMException("bad", "InvalidStateError"));
    const broken = photo(4 * MB);
    expect(await resizeImage(broken, PORTRAIT_RESIZE)).toBe(broken); // undecodable: the server says why
    vi.stubGlobal("createImageBitmap", undefined);
    const old = photo(4 * MB);
    expect(await resizeImage(old, PORTRAIT_RESIZE)).toBe(old); // no createImageBitmap
  });

  it("hands back the original, and still frees the bitmap, when drawing or encoding throws", async () => {
    const create = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => tag !== "canvas" ? create(tag) : {
      width: 0, height: 0,
      getContext: () => ({ drawImage: () => { throw new DOMException("out of memory", "EncodingError"); } }),
      toBlob: () => {},
    }) as typeof document.createElement);
    const file = photo(4 * MB);
    expect(await resizeImage(file, PORTRAIT_RESIZE)).toBe(file);
    expect(bitmap.close).toHaveBeenCalled();
  });
});
