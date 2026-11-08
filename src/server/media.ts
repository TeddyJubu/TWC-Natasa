// Uploaded images under `${DATA_DIR}/uploads/<bucket>/…` and the visibility rules of the old storage policies.
// Buckets: `avatars/<owner id>/<kind>-<ts>.<ext>` (portraits and business logos, private) and
// `neighborhood-logos/<slug>.<ext>` (public brand assets).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { dataDir, type DB } from "./db";
import { AccessError, isAdmin, isMember, type Actor } from "./guard";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export type Bucket = "avatars" | "neighborhood-logos";
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

/** Validates an upload: a real PNG, JPEG or WebP of at most 5 MB. Returns its extension. */
export function checkImage(bytes: Uint8Array): ImageExt {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new AccessError("That image is over 5 MB. Please choose a smaller one.", 400);
  const ext = sniffImage(bytes);
  if (!ext) throw new AccessError("Please choose a JPG, PNG or WebP image.", 400);
  return ext;
}

// One path segment: starts with a letter or digit (so never `.` or `..`), then letters, digits, `.`, `_`, `-`.
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** The absolute file for a bucket-relative name, or null when the name isn't a plain path inside the bucket. */
export function mediaFile(bucket: Bucket, name: string): string | null {
  const parts = name.split("/");
  if (parts.length !== (bucket === "avatars" ? 2 : 1) || !parts.every((p) => SEGMENT.test(p))) return null;
  const root = resolve(uploadsDir(), bucket);
  const file = resolve(root, ...parts);
  return file.startsWith(root + sep) ? file : null;
}

export function writeMedia(bucket: Bucket, name: string, bytes: Uint8Array): void {
  const file = mediaFile(bucket, name);
  if (!file) throw new AccessError("Invalid file name.", 400);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
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

/** Public avatars (owner opted in) may be cached by anyone; everything else in that bucket is private. */
const isPublicAvatarFolder = (db: DB, ownerId: string) =>
  !!db.prepare("select 1 from profiles where id = ? and status = 'approved' and directory_visible = 1 and public_profile = 1").get(ownerId);

const notFound = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });

/**
 * Serves `/media/<bucket>/<name>`. Anything not visible to this actor is a 404 (as if it didn't exist), so
 * the route can't be used to probe for files. `pathname` is the raw URL path, not yet decoded.
 */
export function serveMedia(db: DB, actor: Actor, pathname: string): Response {
  let segments: string[];
  try {
    segments = pathname.replace(/^\/media\//, "").split("/").map(decodeURIComponent);
  } catch {
    return notFound();
  }
  const [bucket, ...rest] = segments;
  if (bucket !== "avatars" && bucket !== "neighborhood-logos") return notFound();
  const file = mediaFile(bucket, rest.join("/"));
  if (!file || (bucket === "avatars" && !canSeeAvatarFolder(db, actor, rest[0]))) return notFound();
  let bytes: Buffer;
  try {
    bytes = readFileSync(file);
  } catch {
    return notFound();
  }
  const ext = sniffImage(bytes);
  if (!ext) return notFound();
  const open = bucket === "neighborhood-logos" || isPublicAvatarFolder(db, rest[0]);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": TYPES[ext],
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": open ? "public, max-age=60" : "private, max-age=3600",
    },
  });
}

/** The URL a stored file is served at. */
export const mediaUrl = (bucket: Bucket, name: string | null | undefined) => (name ? `/media/${bucket}/${name}` : undefined);
