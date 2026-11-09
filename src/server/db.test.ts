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
    expect(one<{ user_version: number }>(db, "pragma user_version").user_version).toBe(5);
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
    writeFileSync(join(dir, "0006_bad.sql"), "create table half (id integer); select * from missing_table;");
    expect(() => migrate(db, dir)).toThrow(/0006_bad\.sql/);
    expect(one<{ user_version: number }>(db, "pragma user_version").user_version).toBe(5);
    expect(one(db, "select name from sqlite_master where name = 'half'")).toBeUndefined();
    expect(() => migrate(db, dir)).toThrow(/0006/);
  });

  it("enforces foreign keys and CHECK constraints", () => {
    const db = openDb(":memory:");
    expect(() => db.prepare("insert into profiles (id) values ('nobody')").run()).toThrow(/FOREIGN KEY/);
    expect(() => db.prepare("insert into neighborhoods (slug, name, color) values ('Bad Slug', 'X', '#000000')").run()).toThrow(/CHECK/);
    expect(() => db.prepare("insert into neighborhoods (slug, name, color) values ('ok', 'X', 'red')").run()).toThrow(/CHECK/);
  });

  it("tx commits, or rolls back on error", () => {
    const db = openDb(":memory:");
    tx(db, () => db.prepare("update catalogue_seq set last = 20").run());
    expect(() => tx(db, () => { db.prepare("update catalogue_seq set last = 99").run(); throw new Error("no"); })).toThrow("no");
    expect(one<{ last: number }>(db, "select last from catalogue_seq").last).toBe(20);
  });
});
