import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "@/server/db";
import { mediaFile } from "@/server/media";
import { addNote, adminCsv, adminNeighborhoods, adminNotes, deleteNote, saveNeighborhoodLogo } from "./admin.server";
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

describe("notes", () => {
  it("sit on one application or member, trimmed, oldest first, with the author's name; delete removes one", () => {
    db.prepare("update profiles set full_name = 'Ada Admin' where id = ?").run(ADMIN);
    const appId = (db.prepare("insert into applications (email, full_name, neighborhood, answers) values ('n@x.test', 'Nia', '', '{}') returning id").get() as { id: string }).id;
    const first = addNote(admin(), { applicationId: appId, body: "  Called her  " });
    const second = addNote(admin(), { memberId: ADMIN, body: "Hosts in May" });
    expect(adminNotes(admin()).map(({ id, application_id, member_id, author_name, body }) => ({ id, application_id, member_id, author_name, body }))).toEqual([
      { id: first, application_id: appId, member_id: null, author_name: "Ada Admin", body: "Called her" },
      { id: second, application_id: null, member_id: ADMIN, author_name: "Ada Admin", body: "Hosts in May" },
    ]);
    deleteNote(admin(), { id: first });
    expect(adminNotes(admin()).map((n) => n.id)).toEqual([second]);
    // A note goes with its subject.
    db.prepare("delete from applications where id = ?").run(appId);
  });

  it("refuse an empty or too-long body and an unknown subject", () => {
    expect(() => addNote(admin(), { memberId: ADMIN, body: "   " })).toThrow(/Invalid note/);
    expect(() => addNote(admin(), { memberId: ADMIN, body: "x".repeat(5001) })).toThrow(/Invalid note/);
    expect(() => addNote(admin(), { applicationId: "nope", body: "hi" })).toThrow(/Invalid note/);
    expect(() => db.prepare("insert into admin_notes (body) values ('orphan')").run()).toThrow(/CHECK/);
  });
});

describe("CSV export", () => {
  it("applications: BOM, CRLF, the card's columns plus answers JSON, formula cells defused", () => {
    db.prepare("insert into applications (email, full_name, neighborhood, answers) values ('c@x.test', '=HYPERLINK(1)', 'Astoria', ?)").run(JSON.stringify({ business: "Bakery, Inc" }));
    const { filename, csv } = adminCsv(admin(), { kind: "applications" });
    expect(filename).toMatch(/^twc-applications-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv.startsWith("\uFEFF\"Submitted (UTC)\",\"Name\",\"Email\"")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(1)","c@x.test","Astoria","Bakery, Inc","pending"`);
    expect(csv).toContain(`"{""business"":""Bakery, Inc""}"\r\n`);
  });

  it("members, and nothing else", () => {
    expect(adminCsv(admin(), { kind: "members" }).csv.split("\r\n")[0]).toBe(
      "\uFEFF\"Name\",\"Status\",\"Listed\",\"Public\",\"Catalogue\",\"Email\",\"Business\",\"Neighborhood\",\"Member since\"");
    expect(() => adminCsv(admin(), { kind: "inbox" })).toThrow(/Invalid export/);
  });
});
