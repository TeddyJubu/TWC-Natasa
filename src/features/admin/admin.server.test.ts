import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "@/server/db";
import { mediaFile } from "@/server/media";
import { adminNeighborhoods, saveNeighborhoodLogo } from "./admin.server";
import { TINY } from "@/test/images";

const ADMIN = "00000000-0000-4000-8000-00000000000a";
const { png: PNG, webp: WEBP } = TINY;
let db: DB;
const admin = () => ({ db, actor: { id: ADMIN, email: "a@x.test" } });

beforeAll(() => {
  vi.stubEnv("DATA_DIR", mkdtempSync(join(tmpdir(), "twc-admin-")));
  db = openDb(":memory:");
  const now = new Date().toISOString();
  db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, 'A', 'a@x.test', 1, ?, ?)`).run(ADMIN, now, now);
  db.prepare("insert into user_roles (user_id, role) values (?, 'admin')").run(ADMIN);
});
afterAll(() => vi.unstubAllEnvs());

describe("neighborhood logos", () => {
  it("are stored as <slug>.<sniffed ext>; a logo under a new extension removes the old file", () => {
    expect(saveNeighborhoodLogo(admin(), "astoria", PNG)).toBe("astoria.png");
    expect(saveNeighborhoodLogo(admin(), "astoria", WEBP)).toBe("astoria.webp");
    expect(existsSync(mediaFile("neighborhood-logos", "astoria.png")!)).toBe(false);
    expect(existsSync(mediaFile("neighborhood-logos", "astoria.webp")!)).toBe(true);
    expect(adminNeighborhoods(admin()).find((n) => n.slug === "astoria")?.logoUrl).toMatch(/^\/media\/neighborhood-logos\/astoria\.webp\?v=\d+$/);
  });

  it("refuse an unknown neighborhood and non-images", () => {
    expect(() => saveNeighborhoodLogo(admin(), "atlantis", PNG)).toThrow(/Invalid neighborhood/);
    expect(() => saveNeighborhoodLogo(admin(), "astoria", new TextEncoder().encode("<svg/>"))).toThrow(/JPG, PNG or WebP/);
  });
});
