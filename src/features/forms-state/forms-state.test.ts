// Membership form open/close (migration 0010 / OPS-081 / OPS-140): public read, admin toggle, POST refuse when closed.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "@/server/db";
import { HttpError } from "@/server/request";
import { submitApplication } from "@/features/applications/applications.server";
import { mintReviewLink, openReview, submitReview } from "@/features/member-links/member-links.server";
import {
  CLOSED_DEFAULT, adminFormsState, assertFormOpen, publicFormState, setMembershipFormOpen,
} from "./forms-state.server";

let db: DB;
const ADMIN = { id: "a1", email: "admin@x.test" };
const MEMBER = "00000000-0000-4000-8000-0000000000be";
const as = (who: { id: string; email: string } | null) => ({ db, actor: who });
const at = () => new Date().toISOString();
afterAll(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://new.example/");
  db = openDb(":memory:");
  const now = at();
  db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values ('a1', 'A', 'admin@x.test', 1, ?, ?)`).run(now, now);
  db.prepare("insert into user_roles (user_id, role) values ('a1', 'admin')").run();
  db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, 'Bea', 'bea@x.test', 1, ?, ?)`).run(MEMBER, now, now);
  db.prepare("update profiles set status = 'approved', full_name = 'Bea' where id = ?").run(MEMBER);
});

describe("publicFormState / assertFormOpen", () => {
  it("defaults both kinds to open with no closed words", () => {
    expect(publicFormState(as(null), { kind: "application" })).toEqual({ kind: "application", open: true, closed: null });
    expect(publicFormState(as(null), { kind: "review" })).toEqual({ kind: "review", open: true, closed: null });
    expect(() => assertFormOpen(db, "application")).not.toThrow();
  });

  it("a missing row is open (OPS-031)", () => {
    db.prepare("delete from forms_state where kind = 'application'").run();
    expect(publicFormState(as(null), { kind: "application" }).open).toBe(true);
    expect(() => assertFormOpen(db, "application")).not.toThrow();
  });

  it("closed uses the stored message, or the default when blank", () => {
    setMembershipFormOpen(as(ADMIN), { kind: "application", open: false, message: "Paused until spring." });
    expect(publicFormState(as(null), { kind: "application" })).toEqual({
      kind: "application", open: false, closed: "Paused until spring.",
    });
    setMembershipFormOpen(as(ADMIN), { kind: "review", open: false, message: "" });
    expect(publicFormState(as(null), { kind: "review" }).closed).toBe(CLOSED_DEFAULT);
    expect(() => assertFormOpen(db, "review")).toThrow(HttpError);
    try { assertFormOpen(db, "review"); } catch (e) {
      expect(e).toMatchObject({ status: 410, message: CLOSED_DEFAULT });
    }
  });
});

describe("setMembershipFormOpen", () => {
  it("requires an admin; opening with no message keeps the last one", () => {
    expect(() => setMembershipFormOpen(as(null), { kind: "application", open: false })).toThrow(/sign in|admin/i);
    setMembershipFormOpen(as(ADMIN), { kind: "application", open: false, message: "Back soon." });
    setMembershipFormOpen(as(ADMIN), { kind: "application", open: true });
    expect(adminFormsState(as(ADMIN)).find((r) => r.kind === "application")).toMatchObject({
      open: true, message: "Back soon.", updated_by: "a1",
    });
  });

  it("does not touch Spotlight (no row)", () => {
    expect(db.prepare("select count(*) as n from forms_state where kind = 'spotlight'").get()).toEqual({ n: 0 });
    expect(() => setMembershipFormOpen(as(ADMIN), { kind: "spotlight", open: false })).toThrow();
  });
});

describe("closed POSTs store nothing", () => {
  it("refuses a closed application", () => {
    setMembershipFormOpen(as(ADMIN), { kind: "application", open: false, message: "Not taking applications." });
    expect(() => submitApplication(as(null), {
      email: "rosa@x.test", fullName: "Rosa", neighborhood: "", answers: {},
    })).toThrow(/Not taking applications/);
    expect(db.prepare("select count(*) as n from applications").get()).toEqual({ n: 0 });
  });

  it("refuses a closed review even with a live link; open still resolves the link", () => {
    const { url } = mintReviewLink(as(ADMIN), { member_id: MEMBER });
    const token = new URL(url).searchParams.get("t")!;
    expect(openReview(as(null), { token })).not.toBeNull();
    setMembershipFormOpen(as(ADMIN), { kind: "review", open: false, message: "Reviews paused." });
    expect(openReview(as(null), { token })).not.toBeNull();
    expect(() => submitReview(as(null), { token, full_name: "Bea", email: "bea@x.test", membership: "keep" }))
      .toThrow(/Reviews paused/);
    expect(db.prepare("select count(*) as n from member_reviews").get()).toEqual({ n: 0 });
    expect(openReview(as(null), { token })).not.toBeNull();
  });
});
