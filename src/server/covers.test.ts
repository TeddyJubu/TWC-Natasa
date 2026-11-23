import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sized, TINY, WITH_GPS } from "@/test/images";
import { cachedCover, coverPath, coverVersion, pruneCovers, resetCoverState, serveCover, type CoverSource } from "./covers";
import { serveMedia } from "./media";
import { openDb } from "./db";
import { RemoteImageError } from "./remote-image";

const SOURCE = "https://images.example/cover.jpg";
const hashOf = (url: string) => createHash("sha256").update(url).digest("hex");
const text = (s: string) => new TextEncoder().encode(s);
let dir: string;
let n = 0;
/** A source address no earlier test has stored. */
const fresh = () => `https://images.example/${++n}.jpg`;
const listed = (url: string): CoverSource => async () => ({ url, unlisted: false });
const request = (url: string, uid = "evt1", extra = "") => new URL(`https://club.test/media/covers/${uid}?v=${coverVersion(url)}${extra}`);
const serve = (url: string, fetcher: (u: string) => Promise<Uint8Array>, source: CoverSource = listed(url), headers = new Headers()) =>
  serveCover(request(url), headers, source, fetcher);

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "twc-covers-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("SITE_PIN", "");
});
afterAll(() => vi.unstubAllEnvs());
beforeEach(() => {
  resetCoverState();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("coverPath", () => {
  it("is keyed by uid and a short hash, and never holds the source address", () => {
    const path = coverPath("evt1", SOURCE)!;
    expect(path).toBe(`/media/covers/evt1?v=${coverVersion(SOURCE)}`);
    expect(path).not.toContain("images.example");
    expect(coverVersion(SOURCE)).toMatch(/^[0-9a-f]{12}$/);
    expect(coverPath("evt1", SOURCE, "Second Shop")).toContain("&business=Second%20Shop");
  });
  it("is null for no cover, a non-https one or an odd uid", () => {
    for (const url of [
      null, undefined, "", "http://images.example/a.jpg", "javascript:alert(1)",
      "https://169.254.169.254/latest/meta-data/", "https://[::1]/a.jpg", "https://images.example:8443/a.jpg", "https://user:pw@images.example/a.jpg",
    ]) expect(coverPath("evt1", url), String(url)).toBeNull();
    expect(coverPath("../evil", SOURCE)).toBeNull();
  });
});

describe("the cover route takes no address from the request", () => {
  it("fetches only the address stored on the event, whatever the query says", async () => {
    const url = fresh();
    const fetcher = vi.fn(async () => TINY.jpg);
    const attack = new URL(`${request(url).href}&url=https://evil.example/x.png&src=http://169.254.169.254/&source=https://evil.example/`);
    expect((await serveCover(attack, new Headers(), listed(url), fetcher)).status).toBe(200);
    expect(fetcher.mock.calls).toEqual([[url]]);
  });

  it.each([
    "/media/covers/https%3A%2F%2Fevil.example%2Fx.png", "/media/covers/https:%2F%2Fevil.example", "/media/covers/..%2F..%2Fsecret",
    "/media/covers/evt1/extra", "/media/covers/", "/media/covers/a.b", `/media/covers/${"x".repeat(65)}`,
  ])("is a 404 for the path %s, without asking Cal", async (path) => {
    const source = vi.fn<CoverSource>(async () => ({ url: SOURCE, unlisted: false }));
    const fetcher = vi.fn(async () => TINY.jpg);
    const res = await serveCover(new URL(`https://club.test${path}?v=${coverVersion(SOURCE)}`), new Headers(), source, fetcher);
    expect(res.status).toBe(404);
    expect(source).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("is a 404 for a missing or stale version, without fetching", async () => {
    const url = fresh();
    const fetcher = vi.fn(async () => TINY.jpg);
    for (const query of ["", "?v=", "?v=000000000000", `?v=${coverVersion("https://images.example/older.jpg")}`]) {
      const res = await serveCover(new URL(`https://club.test/media/covers/evt1${query}`), new Headers(), listed(url), fetcher);
      expect(res.status, query).toBe(404);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("can't read a stored file by name through the ordinary media route", () => {
    const db = openDb(":memory:");
    mkdirSync(join(dir, "uploads", "covers"), { recursive: true });
    writeFileSync(join(dir, "uploads", "covers", "a".repeat(64)), TINY.jpg);
    expect(serveMedia(db, null, `/media/covers/${"a".repeat(64)}`).status).toBe(404);
  });
});

describe("visibility and caching", () => {
  it("an unknown event, one without a cover and an unreachable Cal are the usual 404", async () => {
    const fetcher = vi.fn(async () => TINY.jpg);
    for (const source of [async () => null, async () => { throw new Error("cal down"); }] as CoverSource[]) {
      const res = await serve(SOURCE, fetcher, source);
      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("a listed event's cover is public", async () => {
    const res = await serve(fresh(), async () => TINY.jpg);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("an unlisted event's cover opens by its link but is never publicly cacheable or indexed", async () => {
    const url = fresh();
    const res = await serve(url, async () => TINY.jpg, async () => ({ url, unlisted: true }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("the same file is public for a listed event and private for an unlisted one", async () => {
    const url = fresh();
    expect((await serve(url, async () => TINY.jpg)).headers.get("Cache-Control")).toContain("public");
    expect((await serve(url, async () => TINY.jpg, async () => ({ url, unlisted: true }))).headers.get("Cache-Control")).toContain("private");
  });

  it("stays out of shared caches during the private preview", async () => {
    vi.stubEnv("SITE_PIN", "1234");
    try {
      expect((await serve(fresh(), async () => TINY.jpg)).headers.get("Cache-Control")).toBe("private, max-age=3600");
    } finally {
      vi.stubEnv("SITE_PIN", "");
    }
  });

  it("revalidates with a 304, after the visibility check", async () => {
    const url = fresh();
    const first = await serve(url, async () => TINY.jpg);
    const etag = first.headers.get("ETag")!;
    const again = await serve(url, async () => TINY.jpg, listed(url), new Headers({ "If-None-Match": etag }));
    expect(again.status).toBe(304);
    const gone = await serve(url, async () => TINY.jpg, async () => null, new Headers({ "If-None-Match": etag }));
    expect(gone.status).toBe(404);
  });

  it("passes the business on to the lookup", async () => {
    const url = fresh();
    const source = vi.fn<CoverSource>(async () => ({ url, unlisted: false }));
    await serveCover(request(url, "evt1", "&business=Second%20Shop"), new Headers(), source, async () => TINY.jpg);
    expect(source).toHaveBeenCalledWith("evt1", "Second Shop");
  });
});

describe("what gets stored", () => {
  it.each([
    ["SVG", text(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)],
    ["SVG with an XML prolog", text(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>`)],
    ["HTML", text("<!doctype html><script>alert(1)</script>")],
    ["GIF", text("GIF89a\x01\x00\x01\x00")],
    ["a truncated PNG", TINY.png.slice(0, 20)],
    ["a JPEG header with nothing after it", new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
    ["SVG behind a PNG signature", new Uint8Array([...TINY.png.slice(0, 8), ...text("<svg/>")])],
    ["empty", new Uint8Array()],
  ])("refuses %s by its bytes, stores nothing, and answers 404", async (_name, bytes) => {
    const url = fresh();
    const res = await serve(url, async () => bytes);
    expect(res.status).toBe(404);
    expect(existsSync(join(dir, "uploads", "covers", hashOf(url)))).toBe(false);
  });

  it("refuses an image over 5 MB and one over the dimension limit", async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(TINY.png);
    expect((await serve(fresh(), async () => big)).status).toBe(404);
    expect((await serve(fresh(), async () => sized(4097, 100).jpg)).status).toBe(404);
    expect((await serve(fresh(), async () => sized(4096, 100).jpg)).status).toBe(200);
  });

  it("strips metadata before storing", async () => {
    const url = fresh();
    expect(Buffer.from(WITH_GPS.jpg).includes(Buffer.from("Exif"))).toBe(true);
    const res = await serve(url, async () => WITH_GPS.jpg);
    expect(res.status).toBe(200);
    const stored = readFileSync(join(dir, "uploads", "covers", hashOf(url)));
    expect(stored.includes(Buffer.from("Exif"))).toBe(false);
    expect(Buffer.from(await res.arrayBuffer()).equals(stored)).toBe(true);
  });

  it("names the file by the source's hash and leaves no temp file", async () => {
    const url = fresh();
    await serve(url, async () => TINY.png);
    const names = readdirSync(join(dir, "uploads", "covers"));
    expect(names).toContain(hashOf(url));
    expect(names.filter((name) => name.includes("tmp"))).toEqual([]);
  });

  it("serves a stored cover without fetching again", async () => {
    const url = fresh();
    const fetcher = vi.fn(async () => TINY.webp);
    await serve(url, fetcher);
    const again = await serve(url, fetcher);
    expect(again.headers.get("Content-Type")).toBe("image/webp");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("the fetch queue", () => {
  it("shares one download between simultaneous requests", async () => {
    const url = fresh();
    let release!: (bytes: Uint8Array) => void;
    const fetcher = vi.fn(() => new Promise<Uint8Array>((done) => { release = done; }));
    const all = [serve(url, fetcher), serve(url, fetcher), serve(url, fetcher)];
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    release(TINY.jpg);
    expect((await Promise.all(all)).map((r) => r.status)).toEqual([200, 200, 200]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("runs at most three downloads at once", async () => {
    const releases: (() => void)[] = [];
    let running = 0;
    let peak = 0;
    const fetcher = () => new Promise<Uint8Array>((done) => {
      peak = Math.max(peak, ++running);
      releases.push(() => { running--; done(TINY.jpg); });
    });
    const jobs = Array.from({ length: 6 }, () => cachedCover(fresh(), fetcher));
    await vi.waitFor(() => expect(releases).toHaveLength(3));
    for (let i = 0; i < 6; i++) {
      await vi.waitFor(() => expect(releases.length).toBeGreaterThan(i));
      releases[i]();
    }
    await Promise.all(jobs);
    expect(peak).toBe(3);
  });

  it("remembers a failure briefly, then tries again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const url = fresh();
      const fetcher = vi.fn(async (): Promise<Uint8Array> => { throw new RemoteImageError("status"); });
      expect((await serve(url, fetcher)).status).toBe(404);
      expect((await serve(url, fetcher)).status).toBe(404);
      expect(fetcher).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(5 * 60_000 + 1);
      fetcher.mockImplementationOnce(async () => TINY.jpg);
      expect((await serve(url, fetcher)).status).toBe(200);
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("logs only the reason, never the address (it can carry a token)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const url = "https://images.example/secret-token-abc.jpg";
    await serve(url, async () => { throw new RemoteImageError("address"); });
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret-token-abc");
    expect(log).toHaveBeenCalledWith("[covers] not stored:", "address");
  });
});

describe("the cache's size", () => {
  const seed = (i: number, bytes: number) => {
    const name = hashOf(`prune-${i}-${Math.random()}`);
    const file = join(dir, "uploads", "covers", name);
    writeFileSync(file, new Uint8Array(bytes));
    const at = new Date(Date.now() - 1_000_000 + i * 1000);
    utimesSync(file, at, at);
    return name;
  };

  it("drops the oldest files past the count limit, keeping the newest write", () => {
    rmSync(join(dir, "uploads", "covers"), { recursive: true, force: true });
    mkdirSync(join(dir, "uploads", "covers"), { recursive: true });
    const names = [0, 1, 2, 3].map((i) => seed(i, 10));
    const keep = names[0]; // the oldest, but just written
    pruneCovers(keep, { files: 2, bytes: 1e9 });
    const left = readdirSync(join(dir, "uploads", "covers"));
    expect(left).toContain(keep);
    expect(left).toContain(names[3]);
    expect(left).not.toContain(names[1]);
    expect(left).toHaveLength(2);
  });

  it("drops the oldest files past the byte limit", () => {
    rmSync(join(dir, "uploads", "covers"), { recursive: true, force: true });
    mkdirSync(join(dir, "uploads", "covers"), { recursive: true });
    const names = [10, 11, 12].map((i) => seed(i, 1000));
    pruneCovers(names[2], { files: 100, bytes: 1500 });
    const left = readdirSync(join(dir, "uploads", "covers"));
    expect(left).toContain(names[2]);
    expect(left).not.toContain(names[0]);
  });
});
