// Event covers from our own origin, so no page's CSP has to allow third-party images. `/media/covers/<uid>?v=<hash>` takes
// no address from the request: the uid finds the event in Cal, and only the cover stored on that event is ever fetched.
// Files live in `${DATA_DIR}/uploads/covers/<sha256 of the source address>`, checked and stripped like an upload.
// ponytail: a file is kept until evicted, so a different picture at the same address needs a new address to show.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./db.ts";
import { stripMetadata } from "./image-meta.ts";
import { checkImage, imageType, MAX_FEED_IMAGE_EDGE, notFound, notModified, sniffImage } from "./media.ts";
import { checkRemoteUrl, fetchRemoteImage, RemoteImageError } from "./remote-image.ts";

const UID = /^[\w-]{1,64}$/;
const FAILURE_TTL = 5 * 60_000;
const MAX_FAILURES = 500;
const MAX_DOWNLOADS = 3;
// Small on purpose: the nightly backup tars all of uploads/ and keeps 30 days of it.
export const COVER_LIMITS = { files: 200, bytes: 50 * 1024 * 1024 };

/** What Cal says about an event's cover; `unlisted` keeps it out of shared caches. */
export type CoverSource = (uid: string, business?: string) => Promise<{ url: string; unlisted: boolean } | null>;
type Fetcher = (url: string) => Promise<Uint8Array>;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const coversDir = () => join(dataDir(), "uploads", "covers");
export const coverVersion = (url: string) => sha256(url).slice(0, 12);

/**
 * The same-origin address of an event's cover; null without an https source, or with one that could never be fetched
 * (a blocked IP, another port, credentials), so share tags don't advertise it. Never holds the source address.
 */
export function coverPath(uid: string, url: string | null | undefined, business?: string | null): string | null {
  if (!url?.startsWith("https://") || !UID.test(uid)) return null;
  try {
    checkRemoteUrl(url);
  } catch {
    return null;
  }
  return `/media/covers/${uid}?v=${coverVersion(url)}${business ? `&business=${encodeURIComponent(business)}` : ""}`;
}

const inFlight = new Map<string, Promise<string | null>>();
const failures = new Map<string, number>();
let active = 0;
const waiting: (() => void)[] = [];

/** At most MAX_DOWNLOADS at once: each can hold 5 MB in memory. */
async function withSlot<T>(run: () => Promise<T>): Promise<T> {
  if (active >= MAX_DOWNLOADS) await new Promise<void>((go) => waiting.push(go));
  else active++;
  try {
    return await run();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

/** Removes the oldest files until the cache fits, never the one just written. */
export function pruneCovers(keep: string, limits = COVER_LIMITS): void {
  const dir = coversDir();
  const files = readdirSync(dir).filter((name) => /^[0-9a-f]{64}$/.test(name)).flatMap((name) => {
    try {
      const { size, mtimeMs } = statSync(join(dir, name));
      return [{ name, size, mtimeMs }];
    } catch {
      return [];
    }
  }).sort((a, b) => a.mtimeMs - b.mtimeMs);
  let count = files.length;
  let bytes = files.reduce((sum, f) => sum + f.size, 0);
  for (const f of files) {
    if (count <= limits.files && bytes <= limits.bytes) break;
    if (f.name === keep) continue;
    rmSync(join(dir, f.name), { force: true });
    count--;
    bytes -= f.size;
  }
}

async function download(url: string, key: string, file: string, fetchImage: Fetcher): Promise<string | null> {
  const tmp = `${file}.tmp-${randomBytes(6).toString("hex")}`;
  try {
    const bytes = await withSlot(() => fetchImage(url));
    checkImage(bytes, MAX_FEED_IMAGE_EDGE);
    const clean = stripMetadata(bytes);
    mkdirSync(coversDir(), { recursive: true });
    writeFileSync(tmp, clean);
    renameSync(tmp, file); // atomic: a reader sees the whole image or none
    pruneCovers(key);
    return file;
  } catch (error) {
    rmSync(tmp, { force: true });
    console.error("[covers] not stored:", error instanceof RemoteImageError ? error.reason : "invalid image");
    if (failures.size >= MAX_FAILURES) failures.clear();
    failures.set(key, Date.now() + FAILURE_TTL);
    return null;
  }
}

/** The stored file for a source address, fetching it once however many visitors ask at the same moment. */
export function cachedCover(url: string, fetchImage: Fetcher = fetchRemoteImage): Promise<string | null> {
  const key = sha256(url);
  const file = join(coversDir(), key);
  if (existsSync(file)) return Promise.resolve(file);
  if ((failures.get(key) ?? 0) > Date.now()) return Promise.resolve(null);
  failures.delete(key);
  let job = inFlight.get(key);
  if (!job) {
    job = download(url, key, file, fetchImage).finally(() => inFlight.delete(key));
    inFlight.set(key, job);
  }
  return job;
}

/** Forgets failures and in-flight downloads (tests). */
export function resetCoverState(): void {
  failures.clear();
  inFlight.clear();
}

/**
 * Serves `/media/covers/<uid>?v=<hash>`. An unknown event, one without a usable cover, a stale `v` or a failed download
 * is the usual 404, and the page shows its no-cover fallback. Anyone with an unlisted event's link may open its page, so
 * they may see its cover, but only a listed event's cover outside the private preview is `public`.
 */
export async function serveCover(url: URL, requestHeaders: Headers, source: CoverSource, fetchImage: Fetcher = fetchRemoteImage): Promise<Response> {
  const uid = /^\/media\/covers\/([^/]+)$/.exec(url.pathname)?.[1];
  if (!uid || !UID.test(uid)) return notFound();
  let cover: Awaited<ReturnType<CoverSource>>;
  try {
    cover = await source(uid, url.searchParams.get("business")?.slice(0, 80) || undefined);
  } catch {
    return notFound();
  }
  if (!cover?.url.startsWith("https://") || coverVersion(cover.url) !== url.searchParams.get("v")) return notFound();
  const file = await cachedCover(cover.url, fetchImage);
  if (!file) return notFound();
  try {
    const stat = statSync(file);
    const mtime = Math.floor(stat.mtimeMs);
    const open = !cover.unlisted && !process.env.SITE_PIN;
    const headers: Record<string, string> = {
      "Cache-Control": open ? "public, max-age=60" : "private, max-age=3600",
      ETag: `W/"${stat.size.toString(16)}-${mtime.toString(16)}-${stat.ino.toString(16)}"`,
      "Last-Modified": new Date(mtime).toUTCString(),
      ...(cover.unlisted ? { "X-Robots-Tag": "noindex" } : {}),
    };
    if (notModified(requestHeaders, headers.ETag, mtime)) return new Response(null, { status: 304, headers });
    const bytes = readFileSync(file);
    const ext = sniffImage(bytes);
    if (!ext) return notFound();
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": imageType(ext), "X-Content-Type-Options": "nosniff", ...headers } });
  } catch {
    return notFound();
  }
}
