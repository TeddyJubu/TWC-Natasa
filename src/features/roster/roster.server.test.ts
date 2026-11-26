import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "@/server/db";
import { roster, serveRosterPhoto } from "./roster.server";

const MEMBER = "11111111-1111-4111-8111-111111111111";
const PENDING = "22222222-2222-4222-8222-222222222222";
let db: DB;
let dir: string;

beforeAll(() => {
  db = openDb(":memory:");
  const now = new Date().toISOString();
  for (const [id, email] of [[MEMBER, "m@x.test"], [PENDING, "p@x.test"]])
    db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, 'N', ?, 1, ?, ?)`).run(id, email, now, now);
  db.prepare("update profiles set status = 'approved' where id = ?").run(MEMBER);
  dir = mkdtempSync(join(tmpdir(), "twc-roster-"));
  mkdirSync(join(dir, "roster"));
  writeFileSync(join(dir, "roster", "roster.json"), JSON.stringify({
    leads: { WQ: "A Lead" },
    members: [
      { name: "Ann Example", hood: "Greenpoint", constellation: "NB", file: "ann.webp", role: "Florist", business: "Stems" },
      { name: "Bad Name", hood: "Greenpoint", constellation: "NB", file: "../secret.webp" },
    ],
  }));
  writeFileSync(join(dir, "roster", "ann.webp"), "RIFF0000WEBP");
  writeFileSync(join(dir, "roster", "loose.webp"), "RIFF0000WEBP"); // on disk but not in roster.json
});
beforeEach(() => vi.stubEnv("DATA_DIR", dir));
afterEach(() => vi.unstubAllEnvs());

const actor = (id: string) => ({ id, email: "x@x.test" });
const PHOTO = "/media/roster/ann.webp";

describe("the roster (real members) lives on the server and stays behind the PIN", () => {
  it("reads roster.json from DATA_DIR: photo URLs under /media/roster, leads, and no file name that leaves the folder", () => {
    vi.stubEnv("SITE_PIN", "1234");
    expect(roster({ db, actor: null })).toEqual({
      leads: { WQ: "A Lead" },
      members: [{ name: "Ann Example", hood: "Greenpoint", constellation: "NB", photo: PHOTO, role: "Florist", business: "Stems" }],
    });
  });

  it("while SITE_PIN is set, anyone past the PIN gets the photos, privately cached", () => {
    vi.stubEnv("SITE_PIN", "1234");
    const res = serveRosterPhoto(db, null, PHOTO);
    expect([res.status, res.headers.get("Content-Type"), res.headers.get("Cache-Control")]).toEqual([200, "image/webp", "private, max-age=3600"]);
  });

  it("with the PIN lifted, a visitor or a pending account gets nothing; approved members still do", () => {
    vi.stubEnv("SITE_PIN", "");
    expect(roster({ db, actor: null })).toEqual({ members: [], leads: {} });
    expect(roster({ db, actor: actor(PENDING) }).members).toEqual([]);
    expect(serveRosterPhoto(db, null, PHOTO).status).toBe(404);
    expect(serveRosterPhoto(db, actor(PENDING), PHOTO).status).toBe(404);
    expect(roster({ db, actor: actor(MEMBER) }).members).toHaveLength(1);
    expect(serveRosterPhoto(db, actor(MEMBER), PHOTO).status).toBe(200);
  });

  it("serves only files roster.json names: no other file, no path out of the folder", () => {
    vi.stubEnv("SITE_PIN", "1234");
    for (const p of ["/media/roster/loose.webp", "/media/roster/roster.json", "/media/roster/../../x.webp", "/media/roster/", "/media/roster/%2e%2e/x.webp"])
      expect(serveRosterPhoto(db, null, p).status).toBe(404);
  });

  it("a server without a roster has none: open seats, no error", () => {
    vi.stubEnv("SITE_PIN", "1234");
    vi.stubEnv("DATA_DIR", join(dir, "nowhere"));
    expect(roster({ db, actor: null })).toEqual({ members: [], leads: {} });
    expect(serveRosterPhoto(db, null, PHOTO).status).toBe(404);
  });
});
