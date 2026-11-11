import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "./db";
import { TINY, WITH_GPS } from "@/test/images";
import { checkImage, mediaFile, serveMedia, sniffImage, writeMedia } from "./media";

const { png: PNG, jpg: JPG, webp: WEBP } = TINY;
const OWNER = "00000000-0000-4000-8000-0000000000aa";
let dir: string;
let db: DB;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "twc-media-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("BETTER_AUTH_SECRET", "media-test-secret-media-test-secret"); // the /media route resolves the session
  db = openDb(":memory:");
  const now = new Date().toISOString();
  db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, 'O', 'o@x.test', 1, ?, ?)`).run(OWNER, now, now);
  db.prepare("update profiles set status = 'approved', directory_visible = 1, public_profile = 1 where id = ?").run(OWNER);
  writeMedia("avatars", `${OWNER}/avatar-1.png`, JPG); // a JPEG behind a .png name
  writeMedia("neighborhood-logos", "astoria.webp", WEBP);
  writeFileSync(join(dir, "secret.txt"), "top secret");
  mkdirSync(join(dir, "uploads", "avatars", OWNER), { recursive: true });
  writeFileSync(join(dir, "uploads", "avatars", OWNER, "notes.png"), "<script>alert(1)</script>");
});
afterAll(() => vi.unstubAllEnvs());

describe("uploads", () => {
  it("are typed by their first bytes only", () => {
    expect([sniffImage(PNG), sniffImage(JPG), sniffImage(WEBP)]).toEqual(["png", "jpg", "webp"]);
    expect(sniffImage(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
  });

  it("accept PNG, JPEG and WebP up to 5 MB", () => {
    expect(checkImage(PNG)).toBe("png");
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(PNG);
    expect(() => checkImage(big)).toThrow(/over 5 MB/);
    expect(() => checkImage(new TextEncoder().encode("GIF89a"))).toThrow(/JPG, PNG or WebP/);
  });

  it("are stored without their location metadata, and refused when they don't parse", () => {
    writeMedia("avatars", `${OWNER}/gps.jpg`, WITH_GPS.jpg);
    expect(new Uint8Array(readFileSync(mediaFile("avatars", `${OWNER}/gps.jpg`)!))).toEqual(TINY.jpg);
    expect(() => writeMedia("avatars", `${OWNER}/cut.jpg`, TINY.jpg.slice(0, 100))).toThrow(/couldn’t be read/);
    expect(existsSync(mediaFile("avatars", `${OWNER}/cut.jpg`)!)).toBe(false);
  });

  it("only ever resolve to a plain file inside their bucket", () => {
    expect(mediaFile("avatars", `${OWNER}/avatar-1.png`)).toBe(join(dir, "uploads", "avatars", OWNER, "avatar-1.png"));
    for (const name of ["../secret.txt", `${OWNER}/../../secret.txt`, `${OWNER}/.hidden`, "..", `/${OWNER}/a.png`, `${OWNER}\\..\\a.png`, `${OWNER}/a/b.png`]) {
      expect(mediaFile("avatars", name)).toBeNull();
    }
    expect(mediaFile("neighborhood-logos", `${OWNER}/a.png`)).toBeNull();
  });
});

describe("serveMedia", () => {
  const get = (path: string) => serveMedia(db, null, path);

  it("serves a visible file with its sniffed type, nosniff and a cache policy", async () => {
    const res = get(`/media/avatars/${OWNER}/avatar-1.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPG);
    expect(get("/media/neighborhood-logos/astoria.webp").headers.get("Cache-Control")).toBe("public, max-age=60");
  });

  it("serves a public member's portrait and logo by catalogue number, never anyone else's", () => {
    db.prepare("update profiles set catalogue_number = 21, avatar_path = ?, business_logo_url = ? where id = ?")
      .run(`${OWNER}/avatar-1.png`, `${OWNER}/avatar-1.png`, OWNER);
    expect(get("/media/public/21/avatar").status).toBe(200);
    expect(get("/media/public/21/logo").headers.get("Cache-Control")).toBe("public, max-age=60");
    for (const path of ["/media/public/22/avatar", "/media/public/21/secret", "/media/public/x/avatar", "/media/public/21/avatar/extra"]) {
      expect(get(path).status).toBe(404);
    }
    db.prepare("update profiles set public_profile = 0 where id = ?").run(OWNER);
    expect(get("/media/public/21/avatar").status).toBe(404);
    db.prepare("update profiles set public_profile = 1 where id = ?").run(OWNER);
  });

  // SITE-118/167: unpublished / unlisted folders are indistinguishable from missing (404), never a stand-in.
  it("hides a listed-but-private folder from visitors, and a hidden member's folder from everyone but herself", () => {
    db.prepare("update profiles set public_profile = 0 where id = ?").run(OWNER);
    expect(get(`/media/avatars/${OWNER}/avatar-1.png`).status).toBe(404);
    const owner = serveMedia(db, { id: OWNER, email: "o@x.test" }, `/media/avatars/${OWNER}/avatar-1.png`);
    expect([owner.status, owner.headers.get("Cache-Control")]).toEqual([200, "private, max-age=3600"]);
    db.prepare("update profiles set directory_visible = 0, public_profile = 1 where id = ?").run(OWNER);
    expect(get(`/media/avatars/${OWNER}/avatar-1.png`).status).toBe(404);
    expect(get("/media/public/21/avatar").status).toBe(404);
    db.prepare("update profiles set directory_visible = 1, public_profile = 1 where id = ?").run(OWNER);
  });

  it("sends a weak ETag and Last-Modified, and answers a matching revalidation with a 304", () => {
    const path = `/media/avatars/${OWNER}/avatar-1.png`;
    const first = get(path);
    const etag = first.headers.get("ETag")!;
    const lastModified = first.headers.get("Last-Modified")!;
    expect(etag).toMatch(/^W\/"[0-9a-f]+-[0-9a-f]+-[0-9a-f]+"$/);
    expect(Number.isFinite(Date.parse(lastModified))).toBe(true);
    const again = (h: Record<string, string>) => serveMedia(db, null, path, new Headers(h));
    const hit = again({ "If-None-Match": `"other", ${etag}` });
    expect([hit.status, hit.headers.get("ETag"), hit.headers.get("Cache-Control")]).toEqual([304, etag, "public, max-age=60"]);
    expect(hit.body).toBeNull();
    expect(again({ "If-None-Match": etag.slice(2) }).status).toBe(304); // weak comparison
    expect(again({ "If-None-Match": '"stale"' }).status).toBe(200);
    expect(again({ "If-Modified-Since": lastModified }).status).toBe(304);
    expect(again({ "If-Modified-Since": new Date(0).toUTCString() }).status).toBe(200);
    expect(again({ "If-None-Match": '"stale"', "If-Modified-Since": lastModified }).status).toBe(200); // ETag wins
  });

  it("checks visibility before revalidating: a hidden file is a 404 even with its ETag, and a private one stays private", () => {
    const path = `/media/avatars/${OWNER}/avatar-1.png`;
    const etag = get(path).headers.get("ETag")!;
    db.prepare("update profiles set public_profile = 0 where id = ?").run(OWNER);
    expect(serveMedia(db, null, path, new Headers({ "If-None-Match": etag })).status).toBe(404);
    const owner = serveMedia(db, { id: OWNER, email: "o@x.test" }, path, new Headers({ "If-None-Match": etag }));
    expect([owner.status, owner.headers.get("Cache-Control")]).toEqual([304, "private, max-age=3600"]);
    db.prepare("update profiles set public_profile = 1 where id = ?").run(OWNER);
  });

  it("never serves a stored file that isn't an image", () => expect(get(`/media/avatars/${OWNER}/notes.png`).status).toBe(404));

  it.each([
    "/media/avatars/../../secret.txt",
    "/media/avatars/%2e%2e/%2e%2e/secret.txt",
    `/media/avatars/${OWNER}%2f..%2f..%2f..%2fsecret.txt`,
    "/media/neighborhood-logos/..%2f..%2fsecret.txt",
    "/media/neighborhood-logos/..%5c..%5csecret.txt",
    "/media/../../etc/passwd",
    "/media/avatars/%2fetc%2fpasswd",
    "/media/avatars/%E0%A4%A",
    "/media/uploads/avatars",
    "/media/secret.txt",
  ])("refuses path traversal and anything outside a bucket: %s", (path) => expect(get(path).status).toBe(404));
});

describe("/media route", () => {
  it("serves through serveMedia with the request's session (none here: a visitor)", async () => {
    const { Route } = await import("@/routes/media/$");
    const GET = (Route.options.server as { handlers: { GET: (ctx: { request: Request }) => Promise<Response> } }).handlers.GET;
    const ok = await GET({ request: new Request("http://x.test/media/neighborhood-logos/astoria.webp") });
    expect(ok.status).toBe(200);
    const traversal = await GET({ request: new Request("http://x.test/media/avatars/%2e%2e/%2e%2e/secret.txt") });
    expect(traversal.status).toBe(404);
    const etag = ok.headers.get("ETag")!;
    const revalidated = await GET({ request: new Request("http://x.test/media/neighborhood-logos/astoria.webp", { headers: { "If-None-Match": etag } }) });
    expect(revalidated.status).toBe(304);
  });
});
