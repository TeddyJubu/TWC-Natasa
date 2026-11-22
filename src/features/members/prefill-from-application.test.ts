import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "@/server/db";
import { reviewApplication, setMemberStatus } from "@/features/admin/admin.server";
import { ownProfile } from "./members.server";
import { draftFromApplication, prefillProfileFromApplication } from "./prefill-from-application";

const ADMIN = "00000000-0000-4000-8000-00000000000a";
const MEMBER = "00000000-0000-4000-8000-0000000000b1";
let db: DB;
const admin = () => ({ db, actor: { id: ADMIN, email: "a@x.test" } });
const asMember = () => ({ db, actor: { id: MEMBER, email: "bea@x.test" } });

const answers = {
  phone: "718-555-0100",
  role: "Founder",
  business: "Little Loaf",
  website: "https://littleloaf.example",
  idealReferral: "Wholesale bakers",
  industry: ["Food & Beverage"],
  story: "Private story that must never become the bio.",
  directory: {
    choice: "yes" as const,
    bio: "Bea bakes sourdough in Astoria.",
    services: "Bread · Pastry",
    publicationConsent: true as const,
    headshot: {
      paidSession: true as const,
      officialOnly: true as const,
      photoConsent: true as const,
      extraFees: true as const,
      placementNotGuaranteed: true as const,
    },
  },
};

beforeAll(() => {
  vi.stubEnv("DATA_DIR", mkdtempSync(join(tmpdir(), "twc-prefill-")));
  db = openDb(":memory:");
  const now = new Date().toISOString();
  db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, 'A', 'a@x.test', 1, ?, ?)`).run(ADMIN, now, now);
  db.prepare("insert into user_roles (user_id, role) values (?, 'admin')").run(ADMIN);
  db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, 'Bea', 'bea@x.test', 1, ?, ?)`).run(MEMBER, now, now);
});
afterAll(() => vi.unstubAllEnvs());

const profile = () =>
  db.prepare(
    `select full_name, role_title, business, neighborhood, specialty, bio, looking_for, website,
            directory_visible, public_profile, status from profiles where id = ?`,
  ).get(MEMBER) as Record<string, unknown>;

const insertApp = (extra: object = {}, userId: string | null = MEMBER) =>
  (db.prepare(
    `insert into applications (user_id, email, full_name, neighborhood, answers)
     values (?, 'bea@x.test', 'Beatrice Lopez', 'Astoria', ?) returning id`,
  ).get(userId, JSON.stringify({ ...answers, ...extra })) as { id: string }).id;

describe("draftFromApplication", () => {
  const listed = new Set(["Astoria", "Long Island City"]);

  it("maps work fields and directory bio/specialty only when she asked to publish a directory listing", () => {
    expect(draftFromApplication(
      { full_name: "Beatrice Lopez", neighborhood: "Astoria", answers },
      listed,
    )).toEqual({
      full_name: "Beatrice Lopez",
      role_title: "Founder",
      business: "Little Loaf",
      website: "https://littleloaf.example",
      looking_for: "Wholesale bakers",
      bio: "Bea bakes sourdough in Astoria.",
      specialty: "Bread · Pastry",
      neighborhood: "Astoria",
    });
  });

  it("skips directory bio/specialty when she kept the directory private, and uses industry as specialty", () => {
    const draft = draftFromApplication(
      { full_name: "Bea", neighborhood: "Atlantis", answers: { ...answers, directory: { choice: "no" } } },
      listed,
    );
    expect(draft.bio).toBe("");
    expect(draft.specialty).toBe("Food & Beverage");
    expect(draft.neighborhood).toBeNull();
  });

  it("refuses a website that is not http(s)", () => {
    expect(draftFromApplication(
      { full_name: "Bea", neighborhood: "Astoria", answers: { ...answers, website: "littleloaf.example" } },
      listed,
    ).website).toBe("");
  });
});

describe("prefill on approval", () => {
  it("reviewApplication fills blank fields and never turns on visibility", () => {
    db.prepare("update profiles set full_name = '', role_title = '', business = '', neighborhood = null, specialty = '', bio = '', looking_for = '', website = '', directory_visible = 0, public_profile = 0, status = 'pending' where id = ?").run(MEMBER);
    const id = insertApp();
    reviewApplication(admin(), { id, status: "approved" });
    expect(profile()).toMatchObject({
      full_name: "Beatrice Lopez",
      role_title: "Founder",
      business: "Little Loaf",
      neighborhood: "Astoria",
      specialty: "Bread · Pastry",
      bio: "Bea bakes sourdough in Astoria.",
      looking_for: "Wholesale bakers",
      website: "https://littleloaf.example",
      directory_visible: 0,
      public_profile: 0,
      status: "approved",
    });
    db.prepare("delete from applications where id = ?").run(id);
  });

  it("never overwrites fields the member or an admin already wrote", () => {
    db.prepare("update profiles set full_name = 'Bea Kept', role_title = 'Owner', business = '', neighborhood = 'Sunnyside', specialty = '', bio = 'Kept bio', looking_for = '', website = '', directory_visible = 0, public_profile = 0, status = 'pending' where id = ?").run(MEMBER);
    const id = insertApp();
    reviewApplication(admin(), { id, status: "approved" });
    expect(profile()).toMatchObject({
      full_name: "Bea Kept",
      role_title: "Owner",
      business: "Little Loaf",
      neighborhood: "Sunnyside",
      bio: "Kept bio",
      specialty: "Bread · Pastry",
    });
    db.prepare("delete from applications where id = ?").run(id);
  });

  it("setMemberStatus prefills the same way", () => {
    db.prepare("update profiles set full_name = '', role_title = '', business = '', neighborhood = null, specialty = '', bio = '', looking_for = '', website = '', directory_visible = 0, public_profile = 0, status = 'pending' where id = ?").run(MEMBER);
    const id = insertApp();
    setMemberStatus(admin(), { id: MEMBER, status: "approved" });
    expect(profile()).toMatchObject({
      role_title: "Founder",
      business: "Little Loaf",
      neighborhood: "Astoria",
      directory_visible: 0,
      public_profile: 0,
    });
    db.prepare("delete from applications where id = ?").run(id);
  });

  it("undo-decline (back to pending) does not prefill", () => {
    db.prepare("update profiles set full_name = '', role_title = '', business = '', neighborhood = null, specialty = '', bio = '', looking_for = '', website = '', status = 'pending' where id = ?").run(MEMBER);
    const id = insertApp();
    setMemberStatus(admin(), { id: MEMBER, status: "declined" });
    setMemberStatus(admin(), { id: MEMBER, status: "pending" });
    expect(profile()).toMatchObject({
      role_title: "",
      business: "",
      neighborhood: null,
      status: "pending",
    });
    db.prepare("delete from applications where id = ?").run(id);
  });

  it("never copies phone into the profile", () => {
    db.prepare("update profiles set role_title = '', business = '', status = 'pending' where id = ?").run(MEMBER);
    const id = insertApp();
    reviewApplication(admin(), { id, status: "approved" });
    const row = JSON.stringify(profile());
    expect(row).not.toContain("718-555-0100");
    expect(row).not.toContain("phone");
    db.prepare("delete from applications where id = ?").run(id);
  });

  it("claim path: ownProfile prefills after an approved application is linked", () => {
    db.prepare("update profiles set full_name = 'Bea', role_title = '', business = '', neighborhood = null, specialty = '', bio = '', looking_for = '', website = '', directory_visible = 0, public_profile = 0, status = 'approved' where id = ?").run(MEMBER);
    const id = insertApp({ directory: { choice: "no" } });
    const data = ownProfile(asMember());
    expect(data?.profile).toMatchObject({
      role_title: "Founder",
      business: "Little Loaf",
      neighborhood: "Astoria",
      specialty: "Food & Beverage",
      bio: "",
      directory_visible: false,
      public_profile: false,
    });
    // Idempotent: a second read does not wipe member edits.
    db.prepare("update profiles set role_title = 'Head baker' where id = ?").run(MEMBER);
    prefillProfileFromApplication(db, MEMBER);
    expect(profile().role_title).toBe("Head baker");
    db.prepare("delete from applications where id = ?").run(id);
  });
});
