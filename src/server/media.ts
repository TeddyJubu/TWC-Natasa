// Uploaded images under `${DATA_DIR}/uploads/<bucket>/…` and the visibility rules of the old storage policies.
// Buckets: `avatars/<owner id>/<kind>-<ts>.<ext>` (portraits and business logos, private),
// `feed/<author id>/<post id>-<n>.<ext>` (newsfeed photos, members only) and `neighborhood-logos/<slug>.<ext>` (public brand assets).
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { dataDir, type DB } from "./db.ts";
import { AccessError, isAdmin, isMember, type Actor } from "./guard.ts";
import { imageSize, stripMetadata } from "./image-meta.ts";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export type Bucket = "avatars" | "feed" | "neighborhood-logos";
const TYPES = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" } as const;
export type ImageExt = keyof typeof TYPES;

const uploadsDir = () => join(dataDir(), "uploads");

/** The image type from the file's first bytes (never its name or claimed type), or null. */
export function sniffImage(bytes: Uint8Array): ImageExt | null {
  const at = (i: number, ...b: number[]) => b.every((v, j) => bytes[i + j] === v);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (at(0, 0xff, 0xd8, 0xff)) return "jpg";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "webp"; // RIFF....WEBP
  return null;
}

/**
 * The longest side an upload may have. The app shrinks every photo in the browser first (`resizeImage`: portraits to
 * 1600px, logos to 512px, feed photos to 2048px), so these only stop a direct upload or a browser that couldn't.
 */
export const MAX_IMAGE_EDGE = 2560;
export const MAX_FEED_IMAGE_EDGE = 4096;

/** Validates an upload: a real PNG, JPEG or WebP of at most 5 MB and `maxEdge` pixels a side. Returns its extension. */
export function checkImage(bytes: Uint8Array, maxEdge = MAX_IMAGE_EDGE): ImageExt {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new AccessError("That image is over 5 MB. Please choose a smaller one.", 400);
  const ext = sniffImage(bytes);
  if (!ext) throw new AccessError("Please choose a JPG, PNG or WebP image.", 400);
  const size = imageSize(bytes);
  if (!size) throw new AccessError("That image couldn’t be read. Please choose another JPG, PNG or WebP.", 400);
  if (Math.max(size.width, size.height) > maxEdge) {
    throw new AccessError(`That image is over ${maxEdge} pixels on its longest side. Please choose a smaller one.`, 400);
  }
  return ext;
}

// One path segment: starts with a letter or digit (so never `.` or `..`), then letters, digits, `.`, `_`, `-`.
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** The absolute file for a bucket-relative name, or null when the name isn't a plain path inside the bucket. */
export function mediaFile(bucket: Bucket, name: string): string | null {
  const parts = name.split("/");
  if (parts.length !== (bucket === "neighborhood-logos" ? 1 : 2) || !parts.every((p) => SEGMENT.test(p))) return null;
  const root = resolve(uploadsDir(), bucket);
  const file = resolve(root, ...parts);
  return file.startsWith(root + sep) ? file : null;
}

/** Stores an upload without its Exif/XMP/text metadata (location included); throws (400) if it doesn't parse. */
export function writeMedia(bucket: Bucket, name: string, bytes: Uint8Array): void {
  const file = mediaFile(bucket, name);
  if (!file) throw new AccessError("Invalid file name.", 400);
  const clean = stripMetadata(bytes);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, clean);
}

/** Deletes a stored file; a missing one is fine. */
export function removeMedia(bucket: Bucket, name: string): void {
  const file = mediaFile(bucket, name);
  if (file) rmSync(file, { force: true });
}

/**
 * The old "Avatar read" policy: the owner, admins, approved members while the owner is approved and listed,
 * and everyone once she is also public. Hiding from the directory hides every file in her folder.
 */
export function canSeeAvatarFolder(db: DB, actor: Actor, ownerId: string): boolean {
  if (actor?.id === ownerId || isAdmin(db, actor?.id)) return true;
  const owner = db.prepare("select public_profile from profiles where id = ? and status = 'approved' and directory_visible = 1")
    .get(ownerId) as { public_profile: number } | undefined;
  return !!owner && (owner.public_profile === 1 || isMember(db, actor?.id));
}

/**
 * Newsfeed photos: approved members and admins, while the author still is one (the feed hides her posts otherwise).
 * A deleted post's files are deleted with it.
 */
export const canSeeFeedFolder = (db: DB, actor: Actor, authorId: string): boolean =>
  (isMember(db, actor?.id) || isAdmin(db, actor?.id)) && (isMember(db, authorId) || isAdmin(db, authorId));

/** Public avatars (owner opted in) may be cached by anyone; everything else in that bucket is private. */
const isPublicAvatarFolder = (db: DB, ownerId: string) =>
  !!db.prepare("select 1 from profiles where id = ? and status = 'approved' and directory_visible = 1 and public_profile = 1").get(ownerId);

const notFound = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });

/**
 * A public member's portrait or logo by catalogue number (`public/<n>/avatar|logo`), so public cards never carry
 * her id. Same rule as the public avatars: approved, listed and public.
 */
function publicFile(db: DB, rest: string[]): string | null {
  const [n, kind] = rest;
  if (rest.length !== 2 || !/^\d{1,9}$/.test(n) || (kind !== "avatar" && kind !== "logo")) return null;
  const row = db.prepare("select avatar_path, business_logo_url from profiles where catalogue_number = ? and status = 'approved' and directory_visible = 1 and public_profile = 1")
    .get(Number(n)) as { avatar_path: string | null; business_logo_url: string | null } | undefined;
  const name = kind === "avatar" ? row?.avatar_path : row?.business_logo_url;
  return name ? mediaFile("avatars", name) : null;
}

/**
 * Serves `/media/<bucket>/<name>` and `/media/public/<catalogue number>/<avatar|logo>`. Anything not visible to this
 * actor is a 404 (as if it didn't exist), so the route can't be used to probe for files. `pathname` is the raw URL
 * path, not yet decoded. A visible file carries a weak ETag and Last-Modified, and a matching If-None-Match (or, without
 * one, If-Modified-Since) gets a 304; visibility is checked first, so a hidden file is still a 404. Only files anyone may
 * see are `public`; the rest are `private` (the browser's own cache, never a shared one).
 */
export function serveMedia(db: DB, actor: Actor, pathname: string, requestHeaders?: Headers): Response {
  let segments: string[];
  try {
    segments = pathname.replace(/^\/media\//, "").split("/").map(decodeURIComponent);
  } catch {
    return notFound();
  }
  const [bucket, ...rest] = segments;
  let file: string | null;
  let open: boolean;
  if (bucket === "public") {
    file = publicFile(db, rest);
    open = true;
  } else if (bucket === "avatars" || bucket === "feed" || bucket === "neighborhood-logos") {
    file = mediaFile(bucket, rest.join("/"));
    if (file && bucket === "avatars" && !canSeeAvatarFolder(db, actor, rest[0])) file = null;
    if (file && bucket === "feed" && !canSeeFeedFolder(db, actor, rest[0])) file = null;
    open = bucket === "neighborhood-logos" || (bucket === "avatars" && isPublicAvatarFolder(db, rest[0]));
  } else return notFound();
  if (!file) return notFound();
  let bytes: Buffer;
  let stat: { size: number; mtimeMs: number; ino: number };
  try {
    stat = statSync(file);
    bytes = readFileSync(file);
  } catch {
    return notFound();
  }
  const ext = sniffImage(bytes);
  if (!ext) return notFound();
  const mtime = Math.floor(stat.mtimeMs);
  const cache = {
    "Cache-Control": open ? "public, max-age=60" : "private, max-age=3600",
    ETag: `W/"${stat.size.toString(16)}-${mtime.toString(16)}-${stat.ino.toString(16)}"`,
    "Last-Modified": new Date(mtime).toUTCString(),
  };
  if (requestHeaders && notModified(requestHeaders, cache.ETag, mtime)) return new Response(null, { status: 304, headers: cache });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": TYPES[ext], "X-Content-Type-Options": "nosniff", ...cache },
  });
}

/** RFC 9110 13.2.2: If-None-Match (weak comparison) wins; If-Modified-Since only counts without it. */
export function notModified(headers: Headers, etag: string, mtimeMs: number): boolean {
  const ifNoneMatch = headers.get("if-none-match");
  if (ifNoneMatch !== null) {
    const bare = etag.replace(/^W\//, "");
    return ifNoneMatch.split(",").some((tag) => { const t = tag.trim(); return t === "*" || t.replace(/^W\//, "") === bare; });
  }
  const since = Date.parse(headers.get("if-modified-since") ?? "");
  return Number.isFinite(since) && Math.floor(mtimeMs / 1000) * 1000 <= since;
}

/** The URL a stored file is served at. */
export const mediaUrl = (bucket: Bucket, name: string | null | undefined) => (name ? `/media/${bucket}/${name}` : undefined);
