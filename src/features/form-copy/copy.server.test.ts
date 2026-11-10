// Editable wording for the built-in forms (migration 0011), server side: only admins write, and only texts the pages
// ask for. Kept out of form-copy.test.tsx because a jsdom file can't import node:sqlite on Node 22.
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type DB } from "@/server/db";
import { adminFormCopy, publicFormCopy, saveFormCopy } from "./copy.server";
import { COPY_FORMS, COPY_MAX } from "./manifest";

let db: DB;
const ADMIN = { id: "a1", email: "admin@x.test" };
const MEMBER = { id: "m1", email: "bea@x.test" };
const as = (actor: { id: string; email: string } | null) => ({ db, actor });
const rows = () => db.prepare("select form, original, value, updated_by from form_copy order by form, original").all();

beforeEach(() => {
  db = openDb(":memory:");
  const at = new Date().toISOString();
  for (const [id, email] of [["a1", "admin@x.test"], ["m1", "bea@x.test"]]) {
    db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, ?, ?, 1, ?, ?)`).run(id, id, email, at, at);
  }
  db.prepare("insert into user_roles (user_id, role) values ('a1', 'admin')").run();
  db.prepare("update profiles set status = 'approved' where id = 'm1'").run();
});

describe("server", () => {
  it("starts empty: every page shows its defaults", () => {
    for (const form of COPY_FORMS) expect(publicFormCopy(as(null), { form })).toEqual({});
  });

  it("an admin saves wording and the public page reads it, per form", () => {
    saveFormCopy(as(ADMIN), { form: "contact", values: { "Say hello, neighbor.": "  Hello, friend.  ", "Send message": "Send it" } });
    expect(publicFormCopy(as(null), { form: "contact" })).toEqual({ "Say hello, neighbor.": "Hello, friend.", "Send message": "Send it" });
    expect(publicFormCopy(as(null), { form: "partnership" })).toEqual({});
    expect(adminFormCopy(as(ADMIN), { form: "contact" })).toEqual(publicFormCopy(as(null), { form: "contact" }));
    expect(rows()[0]).toMatchObject({ form: "contact", updated_by: "a1" });
  });

  it("a blank value, or the default itself, restores the default by deleting the row", () => {
    saveFormCopy(as(ADMIN), { form: "contact", values: { "Send message": "Send it", "Say hello, neighbor.": "Hi" } });
    saveFormCopy(as(ADMIN), { form: "contact", values: { "Send message": "   ", "Say hello, neighbor.": "Say hello, neighbor." } });
    expect(rows()).toEqual([]);
  });

  it("saving the same wording twice updates one row", () => {
    saveFormCopy(as(ADMIN), { form: "contact", values: { "Send message": "One" } });
    saveFormCopy(as(ADMIN), { form: "contact", values: { "Send message": "Two" } });
    expect(rows()).toHaveLength(1);
    expect(publicFormCopy(as(null), { form: "contact" })).toEqual({ "Send message": "Two" });
  });

  it("only admins write; the editor's own read is admin-only too", () => {
    for (const who of [null, MEMBER]) {
      expect(() => saveFormCopy(as(who), { form: "contact", values: { "Send message": "x" } })).toThrow(/sign in|only/i);
      expect(() => adminFormCopy(as(who), { form: "contact" })).toThrow(/sign in|only/i);
    }
    expect(rows()).toEqual([]);
  });

  it("refuses unknown forms, unknown texts, non-text values and over-long values, saving nothing", () => {
    const save = (input: unknown) => () => saveFormCopy(as(ADMIN), input);
    expect(save({ form: "spotlight", values: {} })).toThrow(/Invalid form/);
    expect(save({ form: "contact", values: { "Not on the page": "x" } })).toThrow(/Invalid wording/);
    expect(save({ form: "contact", values: { "Send message": 5 } })).toThrow(/Invalid wording/);
    expect(save({ form: "contact", values: { "Send message": "x".repeat(COPY_MAX + 1) } })).toThrow(/Invalid wording/);
    expect(save({ form: "contact" })).toThrow(/Invalid wording/);
    // A text from another form's page is not this form's wording.
    expect(save({ form: "contact", values: { "Submit application": "x" } })).toThrow(/Invalid wording/);
    // One bad entry saves none of the others.
    expect(save({ form: "contact", values: { "Send message": "ok", "Nope": "x" } })).toThrow();
    expect(rows()).toEqual([]);
    expect(() => publicFormCopy(as(null), { form: "nope" })).toThrow(/Invalid form/);
  });

  it("ignores a stored text the page no longer has", () => {
    db.prepare("insert into form_copy (form, original, value) values ('contact', 'Old heading', 'Whatever')").run();
    expect(publicFormCopy(as(null), { form: "contact" })).toEqual({});
  });
});
