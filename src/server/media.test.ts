import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "./db";
import { checkImage, mediaFile, serveMedia, sniffImage, writeMedia } from "./media";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1]);
const OWNER = "00000000-0000-4000-8000-0000000000aa";
let dir: string;
let db: DB;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "twc-media-"));
  vi.stubEnv("DATA_DIR", dir);
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
  });
});
