import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NEIGHBORHOOD_SEED } from "@/features/neighborhoods/queries";
import { migrate, openDb, tx } from "./db";

const one = <T,>(db: ReturnType<typeof openDb>, sql: string, ...args: (string | number | null)[]) => db.prepare(sql).get(...args) as T;

describe("database", () => {
  it("migrates a fresh database to the newest user_version, with foreign keys on", () => {
    const db = openDb(":memory:");
    expect(one<{ user_version: number }>(db, "pragma user_version").user_version).toBe(12);
    expect(one<{ foreign_keys: number }>(db, "pragma foreign_keys").foreign_keys).toBe(1);
    expect(one<{ busy_timeout?: number; timeout?: number }>(db, "pragma busy_timeout")).toEqual({ timeout: 5000 });
  });

  it("opens a file database in WAL mode", () => {
    const db = openDb(join(mkdtempSync(join(tmpdir(), "twc-db-")), "twc.db"));
    expect(one<{ journal_mode: string }>(db, "pragma journal_mode").journal_mode).toBe("wal");
  });

  it("seeds the same seven neighborhoods and colors as the bundled fallback", () => {
    const db = openDb(":memory:");
    const rows = db.prepare("select slug, name, color, active from neighborhoods order by sort_order").all();
    expect(rows).toEqual(NEIGHBORHOOD_SEED.map(({ slug, name, color }) => ({ slug, name, color, active: 1 })));
  });

  it("applies only migrations newer than user_version, and rolls back a failing one", () => {
    const db = openDb(":memory:");
    const dir = mkdtempSync(join(tmpdir(), "twc-mig-"));
    writeFileSync(join(dir, "0001_init.sql"), "this would fail if it ran again");
    writeFileSync(join(dir, "0002_inbox.sql"), "this would fail if it ran again");
    writeFileSync(join(dir, "0003_member_links.sql"), "this would fail if it ran again");
    writeFileSync(join(dir, "0004_legacy_import.sql"), "this would fail if it ran again");
    writeFileSync(join(dir, "0005_custom_forms.sql"), "this would fail if it ran again");
    writeFileSync(join(dir, "0006_admin_notes.sql"), "this would fail if it ran again");
    writeFileSync(join(dir, "0007_admin_actions.sql"), "this would fail if it ran again");
    writeFileSync(join(dir, "0008_spotlight_answers.sql"), "this would fail if it ran again");
    writeFileSync(join(dir, "0009_logged_actions.sql"), "this would fail if it ran again");
    writeFileSync(join(dir, "0010_forms_state.sql"), "this would fail if it ran again");
    writeFileSync(join(dir, "0011_form_copy.sql"), "this would fail if it ran again");
    writeFileSync(join(dir, "0012_card_color.sql"), "this would fail if it ran again");
    writeFileSync(join(dir, "0013_bad.sql"), "create table half (id integer); select * from missing_table;");
    expect(() => migrate(db, dir)).toThrow(/0013_bad\.sql/);
    expect(one<{ user_version: number }>(db, "pragma user_version").user_version).toBe(12);
    expect(one(db, "select name from sqlite_master where name = 'half'")).toBeUndefined();
    expect(() => migrate(db, dir)).toThrow(/0013/);
  });

  it("0011: wording rows belong to one of the four public forms, one per default text, plain and bounded", () => {
    const db = openDb(":memory:");
    const add = (form: string, original: string, value: string) => () => db.prepare("insert into form_copy (form, original, value) values (?, ?, ?)").run(form, original, value);
    add("contact", "Send message", "Send it")();
    expect(add("contact", "Send message", "Again")).toThrow(/UNIQUE|constraint/);
    expect(add("spotlight", "Send message", "x")).toThrow(/CHECK/);
    expect(add("contact", "", "x")).toThrow(/CHECK/);
    expect(add("contact", "x".repeat(401), "x")).toThrow(/CHECK/);
    expect(add("contact", "Message", "")).toThrow(/CHECK/);
    expect(add("contact", "Message", "x".repeat(2001))).toThrow(/CHECK/);
  });

  it("0010: seeds application and review open; only those kinds; message ≤ 1,000", () => {
    const db = openDb(":memory:");
    const rows = db.prepare("select kind, open, message from forms_state order by kind").all();
    expect(rows).toEqual([
      { kind: "application", open: 1, message: "" },
      { kind: "review", open: 1, message: "" },
    ]);
    expect(() => db.prepare("insert into forms_state (kind) values ('spotlight')").run()).toThrow(/CHECK/);
    expect(() => db.prepare("update forms_state set message = ? where kind = 'application'").run("x".repeat(1001))).toThrow(/CHECK/);
  });

  it("0009: a logged action needs exactly one subject, a known kind and a calendar date shape", () => {
    const db = openDb(":memory:");
    const uid = "00000000-0000-4000-8000-0000000000aa";
    const now = new Date().toISOString();
    db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, 'A', 'a@x.test', 1, ?, ?)`).run(uid, now, now);
    const appId = (db.prepare("insert into applications (email, full_name, neighborhood, answers) values ('x@x.test', 'X', '', '{}') returning id").get() as { id: string }).id;
    const ok = () => db.prepare("insert into logged_actions (application_id, kind, action_date, note) values (?, 'call', '2026-11-09', '')").run(appId);
    ok();
    expect(() => db.prepare("insert into logged_actions (kind, action_date) values ('call', '2026-11-09')").run()).toThrow(/CHECK/);
    expect(() => db.prepare("insert into logged_actions (application_id, member_id, kind, action_date) values (?, ?, 'call', '2026-11-09')").run(appId, uid)).toThrow(/CHECK/);
    expect(() => db.prepare("insert into logged_actions (application_id, kind, action_date) values (?, 'tea', '2026-11-09')").run(appId)).toThrow(/CHECK/);
    expect(() => db.prepare("insert into logged_actions (application_id, kind, action_date) values (?, 'call', '9 Nov 2026')").run(appId)).toThrow(/CHECK/);
  });

  it("enforces foreign keys and CHECK constraints", () => {
    const db = openDb(":memory:");
    expect(() => db.prepare("insert into profiles (id) values ('nobody')").run()).toThrow(/FOREIGN KEY/);
    expect(() => db.prepare("insert into neighborhoods (slug, name, color) values ('Bad Slug', 'X', '#000000')").run()).toThrow(/CHECK/);
    expect(() => db.prepare("insert into neighborhoods (slug, name, color) values ('ok', 'X', 'red')").run()).toThrow(/CHECK/);
  });

  it("0008: a Spotlight answer needs a link or an old record id, a name and an object of answers", () => {
    const db = openDb(":memory:");
    const add = (legacy: string | null, name: string, answers: string) =>
      db.prepare("insert into spotlight_answers (legacy_id, full_name, answers) values (?, ?, ?)").run(legacy, name, answers);
    expect(() => add(null, "Bea", "{}")).toThrow(/CHECK/);
    expect(() => add("old-1", "", "{}")).toThrow(/CHECK/);
    expect(() => add("old-1", "Bea", "[]")).toThrow(/CHECK/);
    add("old-1", "Bea", "{}");
    expect(() => add("old-1", "Bea", "{}")).toThrow(/UNIQUE/);
    expect(() => db.prepare("insert into spotlight_answers (link_id, full_name, answers) values ('nope', 'Bea', '{}')").run()).toThrow(/FOREIGN KEY/);
  });

  it("tx commits, or rolls back on error", () => {
    const db = openDb(":memory:");
    tx(db, () => db.prepare("update catalogue_seq set last = 20").run());
    expect(() => tx(db, () => { db.prepare("update catalogue_seq set last = 99").run(); throw new Error("no"); })).toThrow("no");
    expect(one<{ last: number }>(db, "select last from catalogue_seq").last).toBe(20);
  });
});
