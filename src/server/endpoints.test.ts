// The body-carrying endpoints (/api/images, /api/neighborhood-logos, /api/applications): size and access are
// checked before a single byte of the body is read; applications are rate-limited per client IP.
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "./db";
import { clientIp } from "./request";
import { uploadImage, uploadImageRequest } from "@/features/members/members.server";
import { neighborhoodLogoRequest } from "@/features/admin/admin.server";
import { submitApplicationRequest } from "@/features/applications/applications.server";
import { TINY } from "@/test/images";

const MEMBER = "00000000-0000-4000-8000-0000000000b1";
const ADMIN = "00000000-0000-4000-8000-0000000000a1";
const PNG = TINY.png;
let db: DB;
const as = (id: string | null) => ({ db, actor: id ? { id, email: "x@x.test" } : null });

/** A POST whose body records whether anything read it. */
function post(body: BodyInit | null, headers: Record<string, string>) {
  const state = { read: false };
  const source = body === null ? null : new Response(body).body!;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      state.read = true;
      if (!source) return controller.close();
      const reader = source.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        controller.enqueue(value);
      }
      controller.close();
    },
  }, { highWaterMark: 0 }); // pulled only when something reads the body
  const request = new Request("http://club.test/api/x", { method: "POST", body: stream, headers, duplex: "half" } as RequestInit);
  return { request, state };
}

const form = (fields: Record<string, string | Blob>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
async function multipart(fields: Record<string, string | Blob>) {
  const res = new Response(form(fields));
  const buf = new Uint8Array(await res.arrayBuffer());
  return { body: buf, headers: { "Content-Type": res.headers.get("Content-Type")!, "Content-Length": String(buf.byteLength) } };
}

beforeAll(() => {
  vi.stubEnv("DATA_DIR", mkdtempSync(join(tmpdir(), "twc-endpoints-")));
  db = openDb(":memory:");
  const now = new Date().toISOString();
  for (const id of [MEMBER, ADMIN]) {
    db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, 'X', ?, 1, ?, ?)`).run(id, `${id}@x.test`, now, now);
  }
  db.prepare("insert into user_roles (user_id, role) values (?, 'admin')").run(ADMIN);
});
afterAll(() => vi.unstubAllEnvs());

describe("clientIp", () => {
  it("is cf-connecting-ip, else the first x-forwarded-for entry, else unknown", () => {
    expect(clientIp(new Headers({ "cf-connecting-ip": "203.0.113.5", "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientIp(new Headers({ "x-forwarded-for": " 198.51.100.1 , 10.0.0.1" }))).toBe("198.51.100.1");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("POST /api/images", () => {
  it("refuses a visitor before reading the body", async () => {
    const { request, state } = post("x", { "Content-Length": "1", "Content-Type": "multipart/form-data; boundary=x" });
    expect((await uploadImageRequest(as(null), request)).status).toBe(401);
    expect(state.read).toBe(false);
  });

  it("refuses a body over 6 MB, or of unknown size, before reading it", async () => {
    const big = post("x", { "Content-Length": String(6 * 1024 * 1024 + 1) });
    expect((await uploadImageRequest(as(MEMBER), big.request)).status).toBe(413);
    const unsized = post("x", {});
    expect((await uploadImageRequest(as(MEMBER), unsized.request)).status).toBe(411);
    expect(big.state.read || unsized.state.read).toBe(false);
  });

  it("stores a member's image and returns her profile", async () => {
    const { body, headers } = await multipart({ kind: "avatar", file: new Blob([PNG], { type: "image/png" }) });
    const res = await uploadImageRequest(as(MEMBER), post(body, headers).request);
    expect(res.status).toBe(200);
    expect((await res.json()).avatar_path).toMatch(new RegExp(`^${MEMBER}/avatar-\\d+\\.png$`));
  });

  it("answers a bad image with its message", async () => {
    const { body, headers } = await multipart({ kind: "avatar", file: new Blob(["GIF89a"]) });
    const res = await uploadImageRequest(as(MEMBER), post(body, headers).request);
    expect([res.status, (await res.json()).error]).toEqual([400, "Please choose a JPG, PNG or WebP image."]);
  });
});

describe("POST /api/neighborhood-logos", () => {
  it("refuses a non-admin before reading the body", async () => {
    const { request, state } = post("x", { "Content-Length": "1" });
    expect((await neighborhoodLogoRequest(as(MEMBER), request)).status).toBe(403);
    expect(state.read).toBe(false);
  });

  it("stores an admin's logo", async () => {
    const { body, headers } = await multipart({ slug: "astoria", file: new Blob([PNG]) });
    const res = await neighborhoodLogoRequest(as(ADMIN), post(body, headers).request);
    expect([res.status, await res.json()]).toEqual([200, "astoria.png"]);
  });
});

describe("POST /api/applications", () => {
  const application = (email: string) => JSON.stringify({ email, fullName: "Rosa", neighborhood: "", answers: {} });
  const send = (email: string, ip: string, actor: string | null = null) => {
    const body = application(email);
    return submitApplicationRequest(as(actor), post(body, {
      "Content-Type": "application/json", "Content-Length": String(body.length), "cf-connecting-ip": ip,
    }).request);
  };

  it("refuses a body over 64 KB before reading it", async () => {
    const { request, state } = post("x", { "Content-Length": String(64 * 1024 + 1), "cf-connecting-ip": "192.0.2.1" });
    expect((await submitApplicationRequest(as(null), request)).status).toBe(413);
    expect(state.read).toBe(false);
  });

  it("saves an application, linked to a signed-in applicant", async () => {
    expect((await send("signed@x.test", "192.0.2.2", MEMBER)).status).toBe(204);
    expect(db.prepare("select user_id from applications where email = 'signed@x.test'").get()).toEqual({ user_id: MEMBER });
  });

  it("allows 5 per client IP per 10 minutes, then 429 without reading the body", async () => {
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await send(`a${i}@x.test`, "192.0.2.3")).status);
    expect(statuses).toEqual([204, 204, 204, 204, 204]);
    const body = application("sixth@x.test");
    const sixth = post(body, { "Content-Length": String(body.length), "cf-connecting-ip": "192.0.2.3" });
    expect((await submitApplicationRequest(as(null), sixth.request)).status).toBe(429);
    expect(sixth.state.read).toBe(false);
    expect((await send("other@x.test", "192.0.2.4")).status).toBe(204);
  });

  it("answers a malformed body with 400", async () => {
    const body = "{not json";
    const res = await submitApplicationRequest(as(null), post(body, { "Content-Length": String(body.length), "cf-connecting-ip": "192.0.2.5" }).request);
    expect(res.status).toBe(400);
  });
});

describe("replacing an upload", () => {
  it("deletes the previous file, so each member keeps one portrait and one logo on disk", async () => {
    const files = () => readdirSync(join(process.env.DATA_DIR!, "uploads", "avatars", MEMBER)).sort();
    const now = vi.spyOn(Date, "now");
    for (const [kind, t] of [["avatar", 1], ["avatar", 2], ["logo", 3], ["avatar", 4], ["logo", 5]] as const) {
      now.mockReturnValue(t);
      uploadImage(as(MEMBER), kind, PNG);
    }
    now.mockRestore();
    expect(files()).toEqual(["avatar-4.png", "logo-5.png"]);
    expect(db.prepare("select avatar_path, business_logo_url from profiles where id = ?").get(MEMBER))
      .toEqual({ avatar_path: `${MEMBER}/avatar-4.png`, business_logo_url: `${MEMBER}/logo-5.png` });
  });
});
