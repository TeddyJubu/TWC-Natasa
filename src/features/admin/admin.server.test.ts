import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "@/server/db";
import { mediaFile } from "@/server/media";
import {
  addNote, adminActions, adminApplications, adminCsv, adminMembers, adminNeighborhoods, adminNotes, deleteNote, reviewApplication, saveNeighborhoodLogo,
  setMemberNeighborhood, setMemberStatus,
} from "./admin.server";
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

describe("member neighborhood (CRM-059)", () => {
  it("sets a listed one or clears it, and never touches her application's answer", () => {
    const appId = (db.prepare("insert into applications (user_id, email, full_name, neighborhood, answers) values (?, 'a@x.test', 'Ada', 'Ridgewood', '{}') returning id").get(ADMIN) as { id: string }).id;
    const hood = () => (db.prepare("select neighborhood from profiles where id = ?").get(ADMIN) as { neighborhood: string | null }).neighborhood;
    setMemberNeighborhood(admin(), { id: ADMIN, neighborhood: "Astoria" });
    expect(hood()).toBe("Astoria");
    setMemberNeighborhood(admin(), { id: ADMIN, neighborhood: "" });
    expect(hood()).toBeNull();
    setMemberNeighborhood(admin(), { id: ADMIN, neighborhood: "Sunnyside" });
    setMemberNeighborhood(admin(), { id: ADMIN, neighborhood: null });
    expect(hood()).toBeNull();
    expect((db.prepare("select neighborhood from applications where id = ?").get(appId) as { neighborhood: string }).neighborhood).toBe("Ridgewood");
    db.prepare("delete from applications where id = ?").run(appId);
  });

  it("refuses an unlisted neighborhood and an unknown member", () => {
    expect(() => setMemberNeighborhood(admin(), { id: ADMIN, neighborhood: "Atlantis" })).toThrow(/Invalid neighborhood/);
    expect(() => setMemberNeighborhood(admin(), { id: "nobody", neighborhood: "Astoria" })).toThrow(/Invalid member/);
  });
});

describe("admin activity (0007)", () => {
  it("records approvals, declines, notes and neighborhood changes, newest first, once per real change", () => {
    const before = adminActions(admin()).length;
    const appId = (db.prepare("insert into applications (email, full_name, neighborhood, answers) values ('log@x.test', 'Lou', '', '{}') returning id").get() as { id: string }).id;
    reviewApplication(admin(), { id: appId, status: "declined" });
    reviewApplication(admin(), { id: appId, status: "declined" }); // no change, no row
    const note = addNote(admin(), { applicationId: appId, body: "Private words" });
    deleteNote(admin(), { id: note });
    setMemberNeighborhood(admin(), { id: ADMIN, neighborhood: "Astoria" });
    setMemberNeighborhood(admin(), { id: ADMIN, neighborhood: "Astoria" }); // same value, no row
    setMemberNeighborhood(admin(), { id: ADMIN, neighborhood: null });
    setMemberStatus(admin(), { id: ADMIN, status: "declined" });
    setMemberStatus(admin(), { id: ADMIN, status: "approved" });
    const rows = adminActions(admin()).slice(0, adminActions(admin()).length - before);
    expect(rows.map(({ action, detail, subject_name, actor_name }) => ({ action, detail, subject_name, actor_name }))).toEqual([
      { action: "approved", detail: "", subject_name: "Ada Admin", actor_name: "Ada Admin" },
      { action: "declined", detail: "", subject_name: "Ada Admin", actor_name: "Ada Admin" },
      { action: "neighborhood", detail: "", subject_name: "Ada Admin", actor_name: "Ada Admin" },
      { action: "neighborhood", detail: "Astoria", subject_name: "Ada Admin", actor_name: "Ada Admin" },
      { action: "note_deleted", detail: "", subject_name: "Lou", actor_name: "Ada Admin" },
      { action: "note_added", detail: "", subject_name: "Lou", actor_name: "Ada Admin" },
      { action: "declined", detail: "", subject_name: "Lou", actor_name: "Ada Admin" },
    ]);
    expect(JSON.stringify(rows)).not.toContain("Private words");
    // A removed application keeps its history; nothing can rewrite or delete it.
    db.prepare("delete from applications where id = ?").run(appId);
    expect(adminActions(admin()).find((a) => a.application_id === appId)!.subject_name).toBeNull();
    expect(() => db.prepare("update admin_actions set detail = 'x'").run()).toThrow(/append-only/);
    expect(() => db.prepare("delete from admin_actions").run()).toThrow(/append-only/);
  });
});

describe("duplicates and member summary (CRM-072/073, CRM-038/060)", () => {
  it("flag pending applications by a member's or an imported member's email, and repeats; members get newsletter + application count", () => {
    db.prepare("update profiles set status = 'approved' where id = ?").run(ADMIN);
    db.prepare("insert into legacy_members (legacy_id, email, full_name) values ('m-old', 'old@x.test', 'Olive')").run();
    const ins = (email: string, user: string | null = null) =>
      (db.prepare("insert into applications (user_id, email, full_name, neighborhood, answers) values (?, ?, 'Dup', '', '{}') returning id").get(user, email) as { id: string }).id;
    const [mine, imported, twiceA, twiceB, alone] = [ins("A@x.test"), ins("old@x.test"), ins("two@x.test"), ins("two@x.test"), ins("one@x.test")];
    const flags = new Map(adminApplications(admin()).map((a) => [a.id, a.duplicate]));
    expect([mine, imported, twiceA, twiceB, alone].map((id) => flags.get(id))).toEqual(["member", "member", "applications", "applications", null]);

    db.prepare("insert into newsletter_subscribers (email, source, consent) values ('a@x.test', 'beehiiv', null)").run();
    const me = adminMembers(admin()).find((m) => m.id === ADMIN)!;
    expect(me.newsletter).toEqual({ consent: null });
    expect(me.applications).toBe(1); // her account email; the others are someone else's
    for (const id of [mine, imported, twiceA, twiceB, alone]) db.prepare("delete from applications where id = ?").run(id);
  });
});
