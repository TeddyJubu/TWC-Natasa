// The legacy import (scripts/import-legacy.ts) on an in-memory database, with the synthetic rows in
// scripts/fixtures/, plus the link-on-sign-up rules of migration 0003: a verified email claims what was imported;
// nothing is ever approved by signing up.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { submitApplication } from "@/features/applications/applications.server";
import { openDb, type DB } from "./db";
import { importLegacy, readRows, type Row, type Sources } from "./legacy-import";

const fixture = (name: string) => readRows(`scripts/fixtures/legacy-${name}.json`).rows;
const sources = (): Sources => ({
  applications: fixture("applications"), members: fixture("members"), subscribers: fixture("subscribers"), submissions: fixture("submissions"),
});

const get = <T,>(db: DB, sql: string, ...args: (string | number | null)[]) => db.prepare(sql).get(...args) as T;
const all = <T,>(db: DB, sql: string, ...args: (string | number | null)[]) => db.prepare(sql).all(...args) as T[];
const count = (db: DB, table: string) => get<{ n: number }>(db, `select count(*) as n from ${table}`).n;
const now = () => new Date().toISOString();
let seq = 0;
const addUser = (db: DB, email: string, verified = true) => {
  const id = `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, 'Someone', ?, ?, ?, ?)`).run(id, email, verified ? 1 : 0, now(), now());
  return id;
};
const verify = (db: DB, id: string) => db.prepare(`update "user" set emailVerified = 1 where id = ?`).run(id);
const profile = (db: DB, id: string) =>
  get<{ status: string; business: string; role_title: string; website: string; bio: string; member_since: string | null; catalogue_number: number | null; directory_visible: number; public_profile: number }>(
    db, "select * from profiles where id = ?", id);

const imported = () => {
  const db = openDb(":memory:");
  const report = importLegacy(db, sources());
  return { db, report };
};

describe("import counts", () => {
  it("imports the fixtures and says what it skipped and why", () => {
    const { db, report } = imported();
    expect(report.applications).toEqual({ read: 13, imported: 10, existing: 1, skipped: { merged: 1, bad_email: 1 } });
    expect(report.members).toEqual({ read: 8, imported: 5, existing: 0, skipped: { archived: 1, subscriber: 1, bad_email: 1 } });
    // 4 subscriber rows + 1 Beehiiv row found in members.jsonl + 2 newsletter form rows
    expect(report.subscribers).toEqual({ read: 7, imported: 5, existing: 1, skipped: { bad_email: 1 } });
    expect(report.inbox).toEqual({ read: 11, imported: 4, existing: 0, skipped: { spam: 1, bad_email: 1, newsletter: 2, other_form: 2, tombstone: 1 } });
    expect([count(db, "applications"), count(db, "legacy_members"), count(db, "newsletter_subscribers"), count(db, "inbox_messages")]).toEqual([10, 5, 5, 4]);
  });

  it("scales to the real shape: 128 applications, 120 members, 44 subscribers", () => {
    const db = openDb(":memory:");
    const n = (len: number, make: (i: number) => Row) => Array.from({ length: len }, (_, i) => make(i));
    const src: Sources = {
      applications: n(128, (i) => ({ at: "2026-09-01T10:00:00Z", record_id: `a${i}`, status: i % 4 ? "pending_review" : "approved", answers: { full_name: `Applicant ${i}`, email: `app${i}@example.com` } })),
      members: n(120, (i) => ({ member_id: `m${i}`, full_name: `Member ${i}`, email: `Member${i}@Example.com`, member_status: "approved" })),
      subscribers: n(44, (i) => ({ subscriber_id: `s${i}`, full_name: `Sub ${i}`, email: `sub${i}@example.com`, source: "beehiiv_newsletter" })),
    };
    const first = importLegacy(db, src);
    expect([first.applications.imported, first.members.imported, first.subscribers.imported]).toEqual([128, 120, 44]);
    const again = importLegacy(db, src);
    expect([again.applications.imported, again.members.imported, again.subscribers.imported]).toEqual([0, 0, 0]);
    expect([again.applications.existing, again.members.existing, again.subscribers.existing]).toEqual([128, 120, 44]);
  });

  it("is re-runnable and never overwrites an admin's later edits", () => {
    const { db } = imported();
    db.prepare("update applications set status = 'declined' where legacy_id = 'app-fx-pend-01'").run();
    db.prepare("update newsletter_subscribers set full_name = 'Renamed' where legacy_id = 'newsletter-fx-sub-01'").run();
    const again = importLegacy(db, sources());
    expect(Object.values(again).map((c) => c.imported)).toEqual([0, 0, 0, 0]);
    expect(get<{ status: string }>(db, "select status from applications where legacy_id = 'app-fx-pend-01'").status).toBe("declined");
    expect(get<{ full_name: string }>(db, "select full_name from newsletter_subscribers where legacy_id = 'newsletter-fx-sub-01'").full_name).toBe("Renamed");
  });

  it("dry-run reports the same counts and writes nothing", () => {
    const db = openDb(":memory:");
    const report = importLegacy(db, sources(), { dryRun: true });
    expect(report.applications.imported).toBe(10);
    expect([count(db, "applications"), count(db, "legacy_members"), count(db, "newsletter_subscribers"), count(db, "inbox_messages")]).toEqual([0, 0, 0, 0]);
  });

  it("reads .jsonl exports and drops blank or broken lines", () => {
    const dir = mkdtempSync(join(tmpdir(), "twc-legacy-"));
    const path = join(dir, "members.jsonl");
    writeFileSync(path, `{"member_id":"a"}\n\nnot json\n[1,2]\n{"member_id":"b"}\n`);
    const { rows, bad } = readRows(path);
    expect(rows.map((r) => r.member_id)).toEqual(["a", "b"]);
    expect(bad).toBe(2);
    expect(readRows("scripts/fixtures/legacy-members.json")).toMatchObject({ bad: 0, rows: expect.any(Array) });
  });
});

describe("applications", () => {
  it("maps the old lifecycle to pending / approved / declined and drops merged duplicates", () => {
    const { db } = imported();
    const by = Object.fromEntries(all<{ legacy_id: string; status: string }>(db, "select legacy_id, status from applications").map((r) => [r.legacy_id, r.status]));
    expect(by).toMatchObject({
      "app-fx-pend-01": "pending", "app-fx-pend-02": "pending", "app-fx-appr-01": "approved", "app-fx-appr-02": "approved", "app-fx-heyform-01": "approved",
      "app-fx-rej-01": "declined", "app-fx-auto-01": "declined", "app-fx-dupe-01": "pending", "app-fx-dupe-02": "pending",
    });
    expect(by["app-fx-merged-01"]).toBeUndefined();
    expect(by["app-fx-badmail-01"]).toBeUndefined();
  });

  it("keeps both applications from one email (CRM-173) and ids a row with no record_id by hash (CRM-028)", () => {
    const { db } = imported();
    expect(count(db, "applications where email = 'gia.twice@example.com'")).toBe(2);
    const hashed = get<{ legacy_id: string }>(db, "select legacy_id from applications where email = 'hope.noid@example.com'").legacy_id;
    expect(hashed).toMatch(/^app-[0-9a-f]{12}$/);
  });

  it("lowercases the email, keeps the answers, labels the origin (CRM-031) and stamps review dates only when decided", () => {
    const { db } = imported();
    const bea = get<{ email: string; neighborhood: string; answers: string; created_at: string; reviewed_at: string | null }>(db, "select * from applications where legacy_id = 'app-fx-pend-02'");
    expect(bea.email).toBe("bea.sample@example.com");
    expect(bea.neighborhood).toBe("Williamsburg, Brooklyn");
    expect(bea.created_at).toBe("2026-10-26T09:05:00.000Z");
    expect(bea.reviewed_at).toBeNull();
    const answers = JSON.parse(bea.answers) as { business_practice: string; legacy: { origin: string; id: string } };
    expect(answers.business_practice).toBe("Sample Yoga");
    expect(answers.legacy).toMatchObject({ origin: "Join form", id: "app-fx-pend-02" });
    const label = (id: string) => (JSON.parse(get<{ answers: string }>(db, "select answers from applications where legacy_id = ?", id).answers) as { legacy: { origin: string } }).legacy.origin;
    expect(label("app-fx-heyform-01")).toBe("Old HeyForm");
    expect(get<{ reviewed_at: string }>(db, "select reviewed_at from applications where legacy_id = 'app-fx-appr-01'").reviewed_at).toBe("2026-09-02T10:00:00.000Z");
  });

  it("imports every application unlinked, so no account owns one until she signs up", () => {
    const { db } = imported();
    expect(count(db, "applications where user_id is not null")).toBe(0);
    expect(count(db, `"user"`)).toBe(0);
  });
});

describe("members, newsletter and inbox", () => {
  it("stores approved members as legacy_members — no users, no profiles", () => {
    const { db } = imported();
    expect(count(db, `"user"`) + count(db, "profiles")).toBe(0);
    const mira = get<{ email: string; business: string; role_title: string; website: string; bio: string; member_since: string; origin: string }>(db, "select * from legacy_members where legacy_id = 'fx-appr-02'");
    expect(mira).toMatchObject({ email: "mira.membersen@example.com", business: "Membersen Studio", role_title: "Ceramicist", website: "https://membersen.example.org", bio: "Hand-built tableware.", member_since: "2026-09-03T10:00:00.000Z", origin: "public_application" });
    // "OPS-092": a member id equals the application's record id; they live in different tables, so nothing collides
    expect(get<{ n: number }>(db, "select count(*) as n from applications where legacy_id = 'app-fx-appr-02'").n).toBe(1);
    const hana = get<{ website: string; bio: string }>(db, "select website, bio from legacy_members where legacy_id = 'fx-mem-hana'");
    expect(hana.website).toBe("");          // "@hana_again on Instagram" is not a URL
    expect(hana.bio).toHaveLength(400);     // capped to profiles.bio
    expect(get<{ email: string }>(db, "select email from legacy_members where legacy_id = 'fx-mem-nell'").email).toBe("nell.fixture@example.com");
    expect(count(db, "legacy_members where legacy_id in ('fx-mem-old', 'fx-mem-bad', 'fx-sub-legacy')")).toBe(0);
  });

  it("keeps the newsletter list, records consent only where a form recorded it, and de-duplicates by email", () => {
    const { db } = imported();
    const rows = Object.fromEntries(all<{ email: string; consent: number | null; source: string }>(db, "select email, consent, source from newsletter_subscribers").map((r) => [r.email, r]));
    expect(Object.keys(rows).sort()).toEqual(["lena.reader@example.com", "olive.reader@example.com", "pia.reader@example.com", "rae.subscriber@example.com", "tess.new@example.com"]);
    expect(rows["olive.reader@example.com"]).toMatchObject({ consent: null, source: "beehiiv" });
    expect(rows["lena.reader@example.com"]).toMatchObject({ consent: null, source: "beehiiv" });
    expect(rows["rae.subscriber@example.com"]).toMatchObject({ consent: 1, source: "beehiiv" }); // the form's "yes" fills the unknown
    expect(rows["tess.new@example.com"]).toMatchObject({ consent: 1, source: "website" });
    expect(get<{ subscribed_at: string }>(db, "select subscribed_at from newsletter_subscribers where email = 'pia.reader@example.com'").subscribed_at).toBe("2026-10-01T10:00:00.000Z");
  });

  it("turns contact and partnership submissions into archived inbox rows; spam, custom forms and tombstones stay out", () => {
    const { db } = imported();
    const rows = all<{ kind: string; name: string; topic: string | null; business: string | null; collaboration_type: string | null; status: string; created_at: string }>(
      db, "select * from inbox_messages order by created_at");
    expect(rows.map((r) => [r.kind, r.name])).toEqual([["contact", "Kit Twoaddress"], ["partnership", "Sam Host"], ["partnership", "Quinn Partner"], ["contact", "Pia Question"]]);
    expect(new Set(rows.map((r) => r.status))).toEqual(new Set(["archived"]));
    expect(rows[0]).toMatchObject({ topic: "General", created_at: "2026-10-21T10:00:00.000Z" });
    expect(rows[1]).toMatchObject({ business: "Host Studio", collaboration_type: "host" });
    expect(rows[2]).toMatchObject({ business: "Example Org", collaboration_type: "other" });
    expect(rows[3].topic).toBe("Events");
  });

  it("can import the inbox as new, and does not double-import a message", () => {
    const db = openDb(":memory:");
    importLegacy(db, sources(), { inboxStatus: "new" });
    expect(count(db, "inbox_messages where status = 'new'")).toBe(4);
    importLegacy(db, { submissions: fixture("submissions") });
    expect(count(db, "inbox_messages")).toBe(4);
  });
});

describe("link on sign-up", () => {
  it("an imported member who verifies her email is linked, approved from the old record, and gets her profile filled", () => {
    const { db } = imported();
    const id = addUser(db, "mira.membersen@example.com");
    const p = profile(db, id);
    expect(p).toMatchObject({ status: "approved", business: "Membersen Studio", role_title: "Ceramicist", website: "https://membersen.example.org", bio: "Hand-built tableware.", member_since: "2026-09-03T10:00:00.000Z" });
    expect(p.catalogue_number).toBeGreaterThan(0);
    expect(get<{ user_id: string; linked_at: string }>(db, "select user_id, linked_at from legacy_members where legacy_id = 'fx-appr-02'")).toMatchObject({ user_id: id });
    expect(get<{ user_id: string }>(db, "select user_id from applications where legacy_id = 'app-fx-appr-02'").user_id).toBe(id);
  });

  it("matches the email case-insensitively, whichever side was upper-case", () => {
    const { db } = imported();
    const nell = addUser(db, "NELL.FIXTURE@example.com");
    expect(profile(db, nell).status).toBe("approved");
    const bea = addUser(db, "bea.sample@example.com");
    expect(get<{ user_id: string }>(db, "select user_id from applications where legacy_id = 'app-fx-pend-02'").user_id).toBe(bea);
  });

  it("an unverified sign-up links nothing and copies nothing; verifying later does the link", () => {
    const { db } = imported();
    const id = addUser(db, "hana.again@example.com", false);
    expect(profile(db, id)).toMatchObject({ status: "pending", business: "", member_since: null });
    expect(get<{ user_id: string | null }>(db, "select user_id from legacy_members where legacy_id = 'fx-mem-hana'").user_id).toBeNull();
    verify(db, id);
    expect(profile(db, id)).toMatchObject({ status: "approved", business: "Again Pottery" });
    expect(get<{ user_id: string }>(db, "select user_id from legacy_members where legacy_id = 'fx-mem-hana'").user_id).toBe(id);
  });

  it("never approves from sign-up alone: pending applicants, strangers and declined applicants are not approved", () => {
    const { db } = imported();
    const ada = addUser(db, "ada.fixture@example.com");      // pending application
    const stranger = addUser(db, "nobody@example.com");       // nothing imported
    const dee = addUser(db, "dee.declined@example.com");      // declined application
    expect(profile(db, ada).status).toBe("pending");
    expect(profile(db, stranger).status).toBe("pending");
    expect(profile(db, dee).status).toBe("declined");
    expect(profile(db, ada).member_since).toBeNull();
    expect(get<{ user_id: string }>(db, "select user_id from applications where legacy_id = 'app-fx-pend-01'").user_id).toBe(ada); // linked, still pending
  });

  it("a new /join application cannot ride an imported member's email to approval", () => {
    const { db } = imported();
    submitApplication({ db, actor: null }, { email: "jo.doublet@example.com", fullName: "Not Jo", answers: {} });
    expect(get<{ status: string }>(db, "select status from applications where full_name = 'Not Jo'").status).toBe("pending");
    expect(count(db, `profiles`)).toBe(0);
    const unverified = addUser(db, "jo.doublet@example.com", false);
    expect(profile(db, unverified).status).toBe("pending");
  });

  it("never copies directory or public-page visibility from the old record", () => {
    const { db } = imported();
    db.prepare(`update legacy_members set data = json_set(data, '$.directory', 'yes', '$.public_fields', 'all') where legacy_id = 'fx-mem-jo1'`).run();
    const id = addUser(db, "jo.doublet@example.com");
    expect(profile(db, id)).toMatchObject({ status: "approved", directory_visible: 0, public_profile: 0 });
  });

  it("fills only blank profile fields, and two members sharing a name but not an email stay separate", () => {
    const { db } = imported();
    const jo2 = addUser(db, "jo@doubletdesign.example");
    expect(get<{ user_id: string }>(db, "select user_id from legacy_members where legacy_id = 'fx-mem-jo2'").user_id).toBe(jo2);
    expect(get<{ user_id: string | null }>(db, "select user_id from legacy_members where legacy_id = 'fx-mem-jo1'").user_id).toBeNull();
    // a profile she has already filled in wins over the import
    const pre = openDb(":memory:");
    const uid = addUser(pre, "mira.membersen@example.com", false);
    pre.prepare("update profiles set business = 'Her Own Studio' where id = ?").run(uid);
    importLegacy(pre, sources());
    verify(pre, uid);
    expect(profile(pre, uid)).toMatchObject({ business: "Her Own Studio", status: "approved", role_title: "Ceramicist" });
  });

  it("an import after she has signed up (and verified) is claimed on the next verification, not retroactively", () => {
    const db = openDb(":memory:");
    const id = addUser(db, "nell.fixture@example.com");
    importLegacy(db, sources());
    expect(profile(db, id).status).toBe("pending");           // nothing re-runs for an already-verified account
    expect(get<{ user_id: string | null }>(db, "select user_id from legacy_members where legacy_id = 'fx-mem-nell'").user_id).toBeNull();
  });
});
