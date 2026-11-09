// The access rules, checked against the server functions' domain code: a port of the 113 Postgres RLS checks
// (formerly drizzle/test/rls.sql), same order and names. One shared database, so each check builds on the last.
// "Storage" checks read files through /media (serveMedia): 200 means visible, 404 means not.
import { mkdtempSync } from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "./db";
import type { Ctx } from "./context.server";
import { mediaFile, serveMedia, writeMedia } from "./media";
import { directory, intros, memberPage, ownProfile, publicProfiles, removeLogo, saveProfile, uploadImage } from "@/features/members/members.server";
import { bookHeadshot, listEvents, publicEvents, setRsvp } from "@/features/events/events.server";
import { submitApplication } from "@/features/applications/applications.server";
import { listNeighborhoods } from "@/features/neighborhoods/neighborhoods.server";
import { receiveMessage } from "@/features/contact/contact.server";
import {
  addLoggedAction, addNote, adminActions, adminApplications, adminCsv, adminEvents, adminInbox, adminLoggedActions, adminMembers,
  adminNewsletterSubscribers, adminNotes, archiveMessage, deleteNote, createEvent, createNeighborhood, deleteEvent, editLoggedAction,
  removeLoggedAction, restoreLoggedAction, reviewApplication, setBookingStatus,
  setMemberNeighborhood, setMemberStatus, updateEvent,
} from "@/features/admin/admin.server";
import { adminReviews, markReviewDone, mintReviewLink, openReview, reviewLinkStates, revokeReviewLink, submitReview } from "@/features/member-links/member-links.server";
import { adminSpotlights, openSpotlight, submitSpotlight } from "@/features/member-links/spotlight.server";
import { adminFormResponses, formResponsesCsv, openForm, saveAdminForm, setFormOpen, submitResponse } from "@/features/forms/forms.server";
import { saveForm } from "@/features/forms/store";
import { DEMO_FORMS } from "@/features/forms/fixtures";
import { TINY } from "@/test/images";

const id = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;
const [A, B, C, D, E, F, G] = ["a", "b", "c", "d", "e", "f", "10"].map(id);
const PNG = TINY.png;

let db: DB;
const as = (who: string | null): Ctx => ({ db, actor: who ? { id: who, email: `${who}@x.test` } : null });
const anon = () => as(null);
const run = (sql: string, ...args: (string | number | null)[]) => db.prepare(sql).run(...args);
const get = <T,>(sql: string, ...args: (string | number | null)[]) => db.prepare(sql).get(...args) as T;
const now = () => new Date().toISOString();
/** A superuser fixture write, like the old harness's inserts into auth.users (the triggers run). */
const addUser = (who: string, email: string, verified = true) =>
  run(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, '', ?, ?, ?, ?)`, who, email, verified ? 1 : 0, now(), now());
const file = (who: string, name: string) => writeMedia("avatars", `${who}/${name}`, PNG);
const sees = (who: string | null, path: string) => serveMedia(db, as(who).actor, `/media/avatars/${path}`).status === 200;
const cat = (who: string) => get<{ n: number }>("select catalogue_number as n from profiles where id = ?", who).n;
const status = (who: string) => get<{ status: string }>("select status from profiles where id = ?", who).status;
const app = (email: string) => get<{ id: string; user_id: string | null; status: string; reviewed_at: string | null; reviewed_by: string | null }>(
  "select * from applications where email = ?", email);
const apply = (who: string | null, email: string, fullName: string, extra: Record<string, unknown> = {}) =>
  submitApplication(as(who), { email, fullName, neighborhood: "", answers: {}, ...extra });
const throwsAccess = (fn: () => unknown) => expect(fn).toThrow(/sign in|only|can’t change/i);
let allFiles: string[] = [];

beforeAll(() => {
  vi.stubEnv("DATA_DIR", mkdtempSync(join(tmpdir(), "twc-policy-")));
  db = openDb(":memory:");
  // Fixtures: admin, approved member, pending member.
  addUser(A, "admin@x.test");
  addUser(B, "member@x.test");
  addUser(C, "pending@x.test");
  run("insert into user_roles (user_id, role) values (?, 'admin')", A);
  run("update profiles set status = 'approved', directory_visible = 1, full_name = 'Bea' where id = ?", B);
  file(B, "avatar-1.png");
  file(C, "avatar-1.png");
  file(C, "logo-old.png");
  run("update profiles set business_logo_url = ? where id = ?", `${C}/logo-old.png`, C);
  allFiles = [`${B}/avatar-1.png`, `${C}/avatar-1.png`];
});
afterAll(() => vi.unstubAllEnvs());

describe("access rules (ported from the RLS checks)", () => {
  // ---------- Anonymous visitor ----------
  it("anon cannot read the directory", () => throwsAccess(() => directory(anon())));
  it("anon can read neighborhoods", () => expect(listNeighborhoods(anon())).toHaveLength(7));
  it("anon can submit an application", () => {
    apply(null, "new@x.test", "New Applicant");
    expect(app("new@x.test").user_id).toBeNull();
  });
  it("anon cannot link an application to a user", () => {
    apply(null, "x@x.test", "X", { user_id: B });
    expect(app("x@x.test").user_id).toBeNull();
  });
  it("anon sees no portraits", () => expect(allFiles.filter((f) => sees(null, f))).toEqual([]));

  // ---------- Pending member ----------
  it("has_role is not callable", async () => expect(await serverFunctionNames()).not.toContain("hasRole"));
  it("pending member sees an empty directory", () => expect(directory(as(C))).toEqual([]));
  it("pending member cannot read events", () => throwsAccess(() => listEvents(as(C))));
  it("pending member cannot self-approve", () => {
    throwsAccess(() => saveProfile(as(C), { status: "approved" }));
    expect(status(C)).toBe("pending");
  });
  it("cannot point avatar at another member's file", () => {
    throwsAccess(() => saveProfile(as(C), { avatar_path: `${B}/avatar-1.png` }));
    expect(() => run("update profiles set avatar_path = ? where id = ?", `${B}/avatar-1.png`, C)).toThrow(/CHECK/);
  });
  it("pending member sees own portrait", () => expect(sees(C, `${C}/avatar-1.png`) && sees(C, `${C}/logo-old.png`)).toBe(true));
  it("pending member cannot see member portraits", () => expect(sees(C, `${B}/avatar-1.png`)).toBe(false));
  // T3: approval gates RSVPs and bookings, not just reading events.
  it("pending member cannot RSVP", () => {
    const event = get<{ id: string }>("select id from events order by starts_at limit 1").id;
    throwsAccess(() => setRsvp(as(C), { eventId: event, going: true }));
  });
  it("pending member cannot book a headshot", () =>
    throwsAccess(() => bookHeadshot(as(C), { preferred_date: "2026-12-01", preferred_time: "Morning", notes: "" })));
  // T4: the old probing helper stays closed too.
  it("is_approved is not callable", async () => expect(await serverFunctionNames()).not.toContain("isApproved"));
  // T2: owners delete their own uploads; seeing a file never lets anyone delete it.
  it("fixture: admin sees the member's portrait", () => expect(sees(A, `${B}/avatar-1.png`)).toBe(true));
  it("cannot delete another member's portrait", () => {
    removeLogo(as(A)); // acts only on the caller's own card; nothing takes another member's file
    expect(existsSync(mediaFile("avatars", `${B}/avatar-1.png`)!)).toBe(true);
  });
  it("owner can delete her own portrait", () => {
    removeLogo(as(C));
    expect(existsSync(mediaFile("avatars", `${C}/logo-old.png`)!)).toBe(false);
  });
  it("avatars bucket is private, images only, 5 MB", () => {
    expect(() => uploadImage(as(C), "avatar", new TextEncoder().encode("GIF89a"))).toThrow(/JPG, PNG or WebP/);
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(PNG);
    expect(() => uploadImage(as(C), "avatar", big)).toThrow(/over 5 MB/);
    const res = serveMedia(db, as(C).actor, `/media/avatars/${C}/avatar-1.png`);
    expect([res.headers.get("Cache-Control"), res.headers.get("X-Content-Type-Options")]).toEqual(["private, max-age=3600", "nosniff"]);
  });

  // ---------- Approved member ----------
  it("member sees the directory", () => expect(directory(as(B))).toHaveLength(1));
  it("member reads events", () => expect(listEvents(as(B))).toHaveLength(4));
  it("member cannot self-confirm a booking", () => {
    bookHeadshot(as(B), { preferred_date: "2026-12-01", preferred_time: "Morning", notes: "", status: "confirmed" });
    expect(get<{ status: string }>("select status from headshot_bookings where user_id = ?", B).status).toBe("requested");
  });
  it("member sees visible member portraits", () => expect(sees(B, `${B}/avatar-1.png`)).toBe(true));
  it("member cannot see pending portraits", () => expect(sees(B, `${C}/avatar-1.png`)).toBe(false));
  it("member cannot read others' applications", () => throwsAccess(() => adminApplications(as(B))));
  // T7: card fields are checked in the database, not only in the form.
  it("website must be http(s)", () => expect(() => saveProfile(as(B), { website: "javascript:alert(1)" })).toThrow(/CHECK/));
  it("bio is capped at 400 characters", () => expect(() => saveProfile(as(B), { bio: "x".repeat(401) })).toThrow(/CHECK/));
  it("neighborhood must be a known one", () => expect(() => saveProfile(as(B), { neighborhood: "Atlantis" })).toThrow(/FOREIGN KEY/));

  // A second member hides herself: her earlier portraits disappear for other members.
  it("fixture: hidden member is approved", () => {
    addUser(E, "hidden@x.test");
    run("update profiles set status = 'approved', directory_visible = 0 where id = ?", E);
    file(E, "avatar-old.png");
    allFiles.push(`${E}/avatar-old.png`);
    expect(status(E)).toBe("approved");
  });
  it("hidden member's old portraits are hidden", () => expect(sees(B, `${E}/avatar-old.png`)).toBe(false));

  // ---------- Public profiles (0002) ----------
  // F: approved + listed, turns on her public profile herself. G: pending with the switch on.
  it("fixture: public member is approved", () => {
    addUser(F, "public@x.test");
    addUser(G, "pendingpublic@x.test");
    run("update profiles set status = 'approved', directory_visible = 1, full_name = 'Pia' where id = ?", F);
    file(F, "avatar-1.png");
    run("update profiles set avatar_path = ? where id = ?", `${F}/avatar-1.png`, F);
    file(G, "avatar-1.png");
    allFiles.push(`${F}/avatar-1.png`, `${G}/avatar-1.png`);
    expect(status(F)).toBe("approved");
  });
  it("member can switch on her public profile", () => expect(saveProfile(as(F), { public_profile: true }).public_profile).toBe(true));
  it("pending member can set the switch", () =>
    expect(saveProfile(as(G), { directory_visible: true, public_profile: true }).public_profile).toBe(true));
  it("public_profiles() exposes no id column", () => {
    const cards = publicProfiles(anon());
    expect(cards.map((c) => c.id)).toEqual([`catalogue-${get<{ n: number }>("select catalogue_number as n from profiles where id = ?", F).n}`]);
  });
  it("public cards carry no uuid anywhere, only an opaque portrait URL", () => {
    const json = JSON.stringify(publicProfiles(anon()));
    expect(json).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    const n = get<{ n: number }>("select catalogue_number as n from profiles where id = ?", F).n;
    expect(publicProfiles(anon())[0].image).toBe(`/media/public/${n}/avatar`);
    expect(serveMedia(db, null, `/media/public/${n}/avatar`).status).toBe(200);
  });
  it("anon can call public_profiles()", () => expect(() => publicProfiles(anon())).not.toThrow());
  it("anon can evaluate the avatar policy helpers", () => expect(serveMedia(db, null, `/media/avatars/${F}/avatar-1.png`).status).toBe(200));
  it("anon sees only public profiles", () => expect(publicProfiles(anon()).map((c) => c.name)).toEqual(["Pia"]));
  // Member pages (/members/:slug, by catalogue number): public profiles for anyone, listed ones for insiders only.
  it("anon reads a public member page, with no uuid in it", () => {
    const page = memberPage(anon(), cat(F));
    expect(page?.member.name).toBe("Pia");
    expect(page?.audience).toBe("visitor");
    expect(JSON.stringify(page)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
  it("anon and pending members get no page for a listed, non-public member", () => {
    expect(memberPage(anon(), cat(B))).toBeNull();
    expect(memberPage(as(G), cat(B))).toBeNull();
  });
  it("members and admins read a listed, non-public member's page", () => {
    expect(memberPage(as(F), cat(B))).toMatchObject({ member: { name: "Bea" }, isPublic: false, audience: "member" });
    expect(memberPage(as(A), cat(B))?.member.name).toBe("Bea");
  });
  it("nobody gets a page for an unlisted member", () => {
    expect(memberPage(as(B), cat(E))).toBeNull();
    expect(memberPage(as(A), cat(E))).toBeNull();
  });
  it("member page neighbors follow the same rule", () => {
    run("update profiles set neighborhood = 'Astoria' where id in (?, ?)", B, F);
    expect(memberPage(anon(), cat(F))?.neighbors).toEqual([]);
    expect(memberPage(as(A), cat(F))?.neighbors.map((m) => m.name)).toEqual(["Bea"]);
    run("update profiles set neighborhood = null where id in (?, ?)", B, F);
  });
  it("anon sees only public portraits", () => expect(allFiles.filter((f) => sees(null, f))).toEqual([`${F}/avatar-1.png`]));
  it("pending member sees public profiles, not herself", () => expect(publicProfiles(as(G)).map((c) => c.name)).toEqual(["Pia"]));
  it("hiding from the directory leaves the public site", () => {
    saveProfile(as(F), { directory_visible: false });
    expect(publicProfiles(anon())).toEqual([]);
  });
  it("hiding from the directory hides the public portrait", () => {
    expect(allFiles.filter((f) => sees(null, f))).toEqual([]);
    const n = get<{ n: number }>("select catalogue_number as n from profiles where id = ?", F).n;
    expect(serveMedia(db, null, `/media/public/${n}/avatar`).status).toBe(404);
  });
  it("switching off public_profile leaves the public site", () => {
    saveProfile(as(F), { directory_visible: true, public_profile: false });
    expect(publicProfiles(anon())).toEqual([]);
  });
  it("switching off public_profile hides the portrait", () => expect(allFiles.filter((f) => sees(null, f))).toEqual([]));
  it("member still sees a listed, non-public portrait", () => expect(sees(B, `${F}/avatar-1.png`)).toBe(true));
  it("pending member cannot see a listed, non-public portrait", () => expect(sees(G, `${F}/avatar-1.png`)).toBe(false));
  it("admin still sees a pending applicant's portrait", () => expect(sees(A, `${G}/avatar-1.png`)).toBe(true));

  // Applicant signs up with the anonymous application's email: linked only after confirmation.
  it("unconfirmed sign-up does not claim the application", () => {
    addUser(D, "NEW@x.test", false);
    expect(app("new@x.test").user_id).toBeNull();
  });
  it("confirmed sign-up claims the application", () => {
    run(`update "user" set emailVerified = 1 where id = ?`, D);
    expect(app("new@x.test").user_id).toBe(D);
  });

  // Admin approves the application → profile approved with catalogue number.
  it("approving the application approves the profile", () => {
    reviewApplication(as(A), { id: app("new@x.test").id, status: "approved" });
    expect(status(D)).toBe("approved");
  });
  it("approval assigns a catalogue number", () =>
    expect(get<{ n: number | null }>("select catalogue_number as n from profiles where id = ?", D).n).not.toBeNull());
  it("review is timestamped", () => expect(app("new@x.test").reviewed_at).not.toBeNull());
  it("admin can confirm bookings", () => {
    const booking = get<{ id: string }>("select id from headshot_bookings where user_id = ?", B).id;
    setBookingStatus(as(A), { id: booking, status: "confirmed" });
    expect(get<{ status: string }>("select status from headshot_bookings where id = ?", booking).status).toBe("confirmed");
  });
  it("admin can add a neighborhood", () => {
    createNeighborhood(as(A), { slug: "woodside", name: "Woodside", color: "#3a7d44", sort_order: 8 });
    expect(listNeighborhoods(anon()).map((n) => n.name)).toContain("Woodside");
  });
  // T6: a member changing a confirmed booking sends it back to "requested".
  it("member changing a confirmed booking resets it to requested", () => {
    expect(bookHeadshot(as(B), { preferred_date: "2026-12-01", preferred_time: "Evening", notes: "" }).status).toBe("requested");
    // An approved member can RSVP (the control for the pending check), and the RSVP goes with her login below.
    setRsvp(as(B), { eventId: get<{ id: string }>("select id from events order by starts_at limit 1").id, going: true });
  });

  // Deleting a login removes the member everywhere.
  it("deleted user leaves the directory", () => {
    run(`delete from "user" where id = ?`, B);
    expect(get("select 1 from profiles where id = ?", B)).toBeUndefined();
  });
  it("deleted user's roles, RSVPs and booking go too", () =>
    expect([
      get("select 1 from user_roles where user_id = ?", B),
      get("select 1 from event_rsvps where user_id = ?", B),
      get("select 1 from headshot_bookings where user_id = ?", B),
    ]).toEqual([undefined, undefined, undefined]));

  // ---------- Admin review (0003) ----------
  // 11: approved before she signs up, confirms later. 12: approved, signs up already confirmed.
  // 13: still pending when she confirms. 14: approved member, 15: pending member (join checks).
  it("unconfirmed sign-up stays pending despite an approved application", () => {
    apply(null, "later@x.test", "Later Applicant");
    apply(null, "instant@x.test", "Instant Applicant");
    apply(null, "waiting@x.test", "Waiting Applicant");
    for (const email of ["later@x.test", "instant@x.test"]) reviewApplication(as(A), { id: app(email).id, status: "approved" });
    addUser(id("11"), "later@x.test", false);
    expect([status(id("11")), app("later@x.test").user_id]).toEqual(["pending", null]);
  });
  it("confirming links an approved application and approves the profile", () => {
    run(`update "user" set emailVerified = 1 where id = ?`, id("11"));
    expect(status(id("11"))).toBe("approved");
  });
  it("approval on confirmation assigns catalogue number and member_since", () =>
    expect(get<{ ok: number }>("select catalogue_number is not null and member_since is not null as ok from profiles where id = ?", id("11")).ok).toBe(1));
  it("already-confirmed sign-up with an approved application is approved", () => {
    addUser(id("12"), "Instant@x.test");
    expect(status(id("12"))).toBe("approved");
  });
  it("already-confirmed sign-up gets a catalogue number", () =>
    expect(get<{ n: number | null }>("select catalogue_number as n from profiles where id = ?", id("12")).n).not.toBeNull());
  it("a pending application links on confirmation", () => {
    addUser(id("13"), "waiting@x.test");
    expect(app("waiting@x.test").user_id).toBe(id("13"));
  });
  it("a linked pending application leaves the profile pending", () => expect(status(id("13"))).toBe("pending"));
  it("approval records the reviewing admin", () => expect(app("later@x.test").reviewed_by).toBe(A));
  it("admin cannot rewrite reviewed_by on its own", () => {
    reviewApplication(as(A), { id: app("later@x.test").id, status: "approved", reviewed_by: C });
    expect(app("later@x.test").reviewed_by).toBe(A);
  });
  it("anon cannot pre-fill reviewed_by", () => {
    apply(null, "forged@x.test", "Forged", { reviewed_by: A, status: "approved", reviewed_at: now() });
    expect(app("forged@x.test")).toMatchObject({ reviewed_by: null, status: "pending", reviewed_at: null });
  });

  // Admin data joins profiles to applications; only admins get rows back.
  it("admin joins a profile to its application email", () => {
    addUser(id("14"), "approvedpeer@x.test");
    addUser(id("15"), "pendingpeer@x.test");
    run("update profiles set status = 'approved', directory_visible = 1 where id = ?", id("14"));
    run("update profiles set directory_visible = 1 where id = ?", id("11"));
    expect(adminMembers(as(A)).find((m) => m.id === id("11"))?.email).toBe("later@x.test");
  });
  it("fixture: approved member sees the listed applicant's card", () =>
    expect(directory(as(id("14"))).map((m) => m.id)).toContain(id("11")));
  it("approved member cannot join to an applicant's email", () => {
    expect(JSON.stringify(directory(as(id("14"))))).not.toContain("later@x.test");
    throwsAccess(() => adminMembers(as(id("14"))));
  });
  it("pending member cannot read an applicant's application", () => throwsAccess(() => adminApplications(as(id("15")))));
  it("pending member cannot join to an applicant's email", () => throwsAccess(() => adminMembers(as(id("15")))));

  // Review fixes. 16: a second admin who reviews and then deletes her login. 17: declined before sign-up.
  it("fixture: second admin recorded as reviewer", () => {
    addUser(id("16"), "reviewer@x.test");
    run("insert into user_roles (user_id, role) values (?, 'admin')", id("16"));
    apply(null, "reviewed@x.test", "Reviewed Applicant");
    apply(null, "forgedreview@x.test", "Forged Review");
    apply(null, "declined@x.test", "Declined Applicant");
    reviewApplication(as(id("16")), { id: app("reviewed@x.test").id, status: "approved" });
    expect(app("reviewed@x.test").reviewed_by).toBe(id("16"));
  });
  it("deleting a reviewer's login nulls reviewed_by", () => {
    run(`delete from "user" where id = ?`, id("16"));
    expect(app("reviewed@x.test").reviewed_by).toBeNull();
  });
  it("admin cannot rewrite reviewed_at on its own", () => {
    const before = app("later@x.test").reviewed_at;
    reviewApplication(as(A), { id: app("later@x.test").id, status: "approved", reviewed_at: "2000-01-01T00:00:00.000Z" });
    expect(app("later@x.test").reviewed_at).toBe(before);
  });
  it("a status change records the admin, not a forged reviewed_by", () => {
    reviewApplication(as(A), { id: app("forgedreview@x.test").id, status: "declined", reviewed_by: C });
    expect(app("forgedreview@x.test").reviewed_by).toBe(A);
  });
  it("authenticated insert cannot pre-fill reviewed_by", () => {
    reviewApplication(as(A), { id: app("declined@x.test").id, status: "declined" });
    apply(id("15"), "pendingpeer@x.test", "Pending Peer", { user_id: A, reviewed_by: A });
    expect(app("pendingpeer@x.test")).toMatchObject({ user_id: id("15"), reviewed_by: null });
  });
  it("an application declined before sign-up declines the profile on confirmation", () => {
    addUser(id("17"), "declined@x.test");
    expect(status(id("17"))).toBe("declined");
  });
  it("applications are indexed by lower(email)", () =>
    expect(get<{ sql: string }>("select sql from sqlite_master where type = 'index' and tbl_name = 'applications' and sql is not null").sql).toMatch(/lower\(email\)/));

  // ---------- Cleanup (0004) ----------
  // 20: signs up with no neighborhood. 21, 22: two applications each, reviewed on the profile.
  // 23: two applications, one reviewed directly. 24: no application. 25: non-admin and no-JWT changes.
  it("profiles.neighborhood is nullable with no default", () =>
    expect(get("select \"notnull\" as nn, dflt_value as d from pragma_table_info('profiles') where name = 'neighborhood'")).toEqual({ nn: 0, d: null }));
  it("a new sign-up has no neighborhood", () => {
    addUser(id("20"), "nohood@x.test");
    expect(get<{ n: string | null }>("select neighborhood as n from profiles where id = ?", id("20")).n).toBeNull();
  });
  it("member saves a known neighborhood", () => expect(saveProfile(as(id("20")), { neighborhood: "Astoria" }).neighborhood).toBe("Astoria"));
  it("member clears her neighborhood", () => expect(saveProfile(as(id("20")), { neighborhood: null }).neighborhood).toBeNull());
  it("an unknown neighborhood still fails the foreign key", () =>
    expect(() => saveProfile(as(id("20")), { neighborhood: "Atlantis" })).toThrow(/FOREIGN KEY/));

  it("admin approving a profile approves her newest application, recording the admin", () => {
    for (const n of ["21", "22", "23", "24", "25"]) addUser(id(n), `u${n}@x.test`);
    const ins = "insert into applications (email, full_name, user_id, created_at) values (?, ?, ?, ?)";
    const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
    for (const n of ["21", "22", "23"]) {
      run(ins, `old-${n}@x.test`, `Old ${n}`, id(n), daysAgo(2));
      run(ins, `new-${n}@x.test`, `New ${n}`, id(n), daysAgo(1));
    }
    run(ins, "only-25@x.test", "Only 25", id("25"), daysAgo(1));
    setMemberStatus(as(A), { id: id("21"), status: "approved" });
    expect(app("new-21@x.test")).toMatchObject({ status: "approved", reviewed_by: A });
    expect(app("new-21@x.test").reviewed_at).not.toBeNull();
  });
  it("admin approving a profile leaves her older application alone", () =>
    expect(app("old-21@x.test")).toMatchObject({ status: "pending", reviewed_at: null, reviewed_by: null }));
  it("the directly approved profile is approved with a catalogue number", () =>
    expect(get<{ ok: number }>("select status = 'approved' and catalogue_number is not null as ok from profiles where id = ?", id("21")).ok).toBe(1));
  it("admin declining a profile declines her newest application, recording the admin", () => {
    setMemberStatus(as(A), { id: id("22"), status: "declined" });
    expect(app("new-22@x.test")).toMatchObject({ status: "declined", reviewed_by: A });
  });
  it("admin declining a profile leaves her older application alone", () =>
    expect(app("old-22@x.test")).toMatchObject({ status: "pending", reviewed_at: null }));
  // Undo-decline restores the newest application too (CRM-069); older ones stay alone.
  it("admin undoing a decline puts her newest application back to pending", () => {
    setMemberStatus(as(A), { id: id("22"), status: "pending" });
    expect(app("new-22@x.test")).toMatchObject({ status: "pending", reviewed_by: A });
    expect(app("old-22@x.test")).toMatchObject({ status: "pending", reviewed_at: null });
  });
  it("admin approving an older application approves the profile", () => {
    reviewApplication(as(A), { id: app("old-23@x.test").id, status: "approved" });
    expect(status(id("23"))).toBe("approved");
  });
  it("admin approving one application leaves the user's other application alone", () =>
    expect(app("new-23@x.test")).toMatchObject({ status: "pending", reviewed_at: null }));
  // Her profile is already approved, so approving her other application must not rewrite the profile.
  it("approving an application leaves an already-approved profile untouched", () => {
    run("update profiles set updated_at = '2001-01-01T00:00:00.000Z' where id = ?", id("23"));
    reviewApplication(as(A), { id: app("new-23@x.test").id, status: "approved" });
    expect(get<{ u: string }>("select updated_at as u from profiles where id = ?", id("23")).u).toBe("2001-01-01T00:00:00.000Z");
  });
  it("admin approves a profile that has no application", () => {
    expect(setMemberStatus(as(A), { id: id("24"), status: "approved" })).toBeNull();
    expect(get<{ ok: number }>("select status = 'approved' and catalogue_number is not null as ok from profiles where id = ?", id("24")).ok).toBe(1);
  });
  it("a member's own status change touches neither her profile nor her application", () => {
    throwsAccess(() => saveProfile(as(id("25")), { status: "approved" }));
    throwsAccess(() => setMemberStatus(as(id("25")), { id: id("25"), status: "approved" }));
    expect([status(id("25")), app("only-25@x.test").status, app("only-25@x.test").reviewed_at]).toEqual(["pending", "pending", null]);
  });
  it("fixture: a no-JWT write changes the profile status", () => {
    run("update profiles set status = 'approved' where id = ?", id("25"));
    expect(status(id("25"))).toBe("approved");
  });
  it("a no-JWT status change leaves the application alone", () =>
    expect(app("only-25@x.test")).toMatchObject({ status: "pending", reviewed_at: null, reviewed_by: null }));

  // ---------- 0005: business logos ----------
  // Logos live in the member's own avatars folder (`<id>/logo-<ts>.<ext>`), so the portrait rules apply unchanged.
  const [L30, L31, L32] = ["30", "31", "32"].map(id);
  it("profiles.business_logo_url is nullable text", () => {
    for (const [who, email] of [[L30, "logo-a@x.test"], [L31, "logo-b@x.test"], [L32, "logo-hidden@x.test"]]) addUser(who, email);
    run(`update profiles set status = 'approved', directory_visible = (id <> ?) where id in (?, ?, ?)`, L32, L30, L31, L32);
    file(L31, "logo-1.png");
    file(L32, "logo-1.png");
    run("update profiles set business_logo_url = ? where id = ?", `${L31}/logo-1.png`, L31);
    run("update profiles set business_logo_url = ? where id = ?", `${L32}/logo-1.png`, L32);
    expect(get("select \"notnull\" as nn, type from pragma_table_info('profiles') where name = 'business_logo_url'")).toEqual({ nn: 0, type: "TEXT" });
  });
  let ownLogo = "";
  it("member can upload a logo to her own folder", () => {
    ownLogo = uploadImage(as(L30), "logo", PNG).business_logo_url!;
    expect(existsSync(mediaFile("avatars", ownLogo)!)).toBe(true);
  });
  it("cannot upload a logo into another member's folder", () => {
    expect(ownLogo.startsWith(`${L30}/logo-`)).toBe(true); // the folder is always the caller's own
    expect(mediaFile("avatars", `${L31}/../${L30}/x.png`)).toBeNull();
  });
  it("owner can set her own logo", () => expect(get<{ u: string }>("select business_logo_url as u from profiles where id = ?", L30).u).toBe(ownLogo));
  it("cannot point her logo at another member's file", () => {
    throwsAccess(() => saveProfile(as(L30), { business_logo_url: `${L31}/logo-1.png` }));
    expect(() => run("update profiles set business_logo_url = ? where id = ?", `${L31}/logo-1.png`, L30)).toThrow(/CHECK/);
  });
  it("another member cannot change her logo; the directory returns it", () => {
    throwsAccess(() => saveProfile(as(L30), { id: L31, business_logo_url: null }));
    expect(directory(as(L30)).find((m) => m.id === L31)?.logo).toBe(`/media/avatars/${L31}/logo-1.png`);
  });
  it("members can read a listed member's logo", () => expect(sees(L30, `${L31}/logo-1.png`)).toBe(true));
  it("members cannot read a hidden member's logo", () => expect(sees(L30, `${L32}/logo-1.png`)).toBe(false));
  it("a hidden member still reads her own logo", () => expect(sees(L32, `${L32}/logo-1.png`)).toBe(true));
  it("owner can remove her logo", () => expect(removeLogo(as(L32)).business_logo_url).toBeNull());
  it("anon reads no logos of non-public members", () =>
    expect([`${L30}/${ownLogo.split("/")[1]}`, `${L31}/logo-1.png`, `${L32}/logo-1.png`].filter((f) => sees(null, f))).toEqual([]));

  it("intros show only other approved, listed members, and only to members", () => {
    expect(intros(as(id("15")), null)).toEqual([]);
    expect(intros(as(L30), null).map((m) => m.id)).not.toContain(L30);
  });

  // ---------- Gatherings: the public calendar and the admin card ----------
  const gathering = { title: "Skyline Picnic", description: "", location: "Rainey Park", neighborhood: "Astoria", starts_at: "2026-12-05T17:00:00.000Z", kind: "gathering" };
  let picnic = "";
  it("fixture: an approved member saves a seat", () => {
    picnic = createEvent(as(A), gathering);
    setRsvp(as(F), { eventId: picnic, going: true });
    expect(get<{ n: number }>("select count(*) as n from event_rsvps where event_id = ?", picnic).n).toBe(1);
  });
  it("anon reads upcoming gatherings, public fields only, no RSVPs or member data", () => {
    const rows = publicEvents(anon(), "2026-12-01T00:00:00.000Z");
    expect(rows.map((r) => r.title)).toEqual(["Skyline Picnic"]);
    expect(Object.keys(rows[0]).sort()).toEqual(["description", "id", "kind", "location", "neighborhood", "starts_at", "title"]);
    expect(JSON.stringify(rows)).not.toContain(F);
    expect(JSON.stringify(rows)).not.toContain("public@x.test");
  });
  it("public gatherings leave out past ones", () => expect(publicEvents(anon(), "2026-12-06T00:00:00.000Z")).toEqual([]));
  it("pending member reads public gatherings, still not the members' list", () => {
    expect(publicEvents(as(C), "2026-12-01T00:00:00.000Z")).toHaveLength(1);
    throwsAccess(() => listEvents(as(C)));
  });
  it.each([["anon", null], ["pending member", C], ["approved member", F]])("%s cannot read or change gatherings as an admin", (_who, who) => {
    throwsAccess(() => adminEvents(as(who)));
    throwsAccess(() => createEvent(as(who), gathering));
    throwsAccess(() => updateEvent(as(who), { ...gathering, id: picnic, title: "Hijacked" }));
    throwsAccess(() => deleteEvent(as(who), { id: picnic }));
    expect(get<{ title: string }>("select title from events where id = ?", picnic).title).toBe("Skyline Picnic");
  });
  it("admin sees each gathering's guest list", () => {
    const row = adminEvents(as(A)).find((e) => e.id === picnic)!;
    expect(row.guests.map((g) => [g.user_id, g.full_name, g.email])).toEqual([[F, "Pia", "public@x.test"]]);
  });
  it("admin edits a gathering", () => {
    updateEvent(as(A), { ...gathering, id: picnic, title: "  Skyline Supper ", kind: "supper" });
    expect(get<{ title: string; kind: string }>("select title, kind from events where id = ?", picnic)).toEqual({ title: "Skyline Supper", kind: "supper" });
  });
  it.each([
    ["an empty title", { title: "  " }, /title/],
    ["an empty location", { location: "" }, /location/],
    ["an unknown neighborhood", { neighborhood: "Atlantis" }, /neighborhood/],
    ["an unknown kind", { kind: "rave" }, /kind/],
    ["a start that isn't a date", { starts_at: "next Saturday" }, /start time/],
    ["an over-long description", { description: "x".repeat(601) }, /description/],
  ])("admin cannot save a gathering with %s", (_what, over, message) => {
    expect(() => createEvent(as(A), { ...gathering, ...over })).toThrow(message);
    expect(() => updateEvent(as(A), { ...gathering, ...over, id: picnic })).toThrow(message);
  });
  it("editing a gathering that doesn't exist fails", () => expect(() => updateEvent(as(A), { ...gathering, id: "nope" })).toThrow(/gathering/));
  it("deleting a gathering deletes its saved seats", () => {
    deleteEvent(as(A), { id: picnic });
    expect(get<{ n: number }>("select count(*) as n from events where id = ?", picnic).n).toBe(0);
    expect(get<{ n: number }>("select count(*) as n from event_rsvps where event_id = ?", picnic).n).toBe(0);
  });
  // ---------- Inbox (0002): anyone writes through the two forms; only admins read or archive ----------
  const inboxed = (email: string) => get<{ status: string } | undefined>("select status from inbox_messages where email = ?", email);
  it("anon can send a contact message and a partnership inquiry", async () => {
    await receiveMessage(anon(), "contact", { name: "Vi", email: "vi@x.test", topic: "Press", message: "Hi", consent: true });
    await receiveMessage(anon(), "partnership", { name: "Jo", email: "jo@x.test", collaboration_type: "host", message: "Hi", consent: true });
    expect([inboxed("vi@x.test")?.status, inboxed("jo@x.test")?.status]).toEqual(["new", "new"]);
  });
  it("a sender cannot set a message's status or kind", async () => {
    await receiveMessage(anon(), "contact", { name: "Sly", email: "sly@x.test", topic: "Press", message: "Hi", consent: true, status: "archived", kind: "partnership" });
    expect(get<{ status: string; kind: string }>("select status, kind from inbox_messages where email = 'sly@x.test'")).toEqual({ status: "new", kind: "contact" });
  });
  it.each([["anon", null], ["pending member", C], ["approved member", B]])("%s cannot read or archive the inbox", (_who, who) => {
    const msg = get<{ id: string }>("select id from inbox_messages where email = 'vi@x.test'").id;
    throwsAccess(() => adminInbox(as(who)));
    throwsAccess(() => archiveMessage(as(who), { id: msg }));
    expect(inboxed("vi@x.test")?.status).toBe("new");
  });
  it("admin reads every message newest first, and archives one out of Needs attention", () => {
    expect(adminInbox(as(A)).map((m) => m.email)).toEqual(["sly@x.test", "jo@x.test", "vi@x.test"]);
    archiveMessage(as(A), { id: adminInbox(as(A)).find((m) => m.email === "vi@x.test")!.id });
    expect(inboxed("vi@x.test")?.status).toBe("archived");
    const inbox = adminInbox(as(A));
    expect(inbox.map((m) => m.email)).toEqual(["sly@x.test", "jo@x.test", "vi@x.test"]);
    expect(inbox.filter((m) => m.status === "new").map((m) => m.email)).toEqual(["sly@x.test", "jo@x.test"]);
    expect(inbox.find((m) => m.email === "vi@x.test")?.status).toBe("archived");
  });
  it("admin archive refuses a malformed id", () => expect(() => archiveMessage(as(A), { id: 42 })).toThrow(/Invalid message/));
});

// ---------- Member review links (migration 0003) ----------
describe("member review links", () => {
  const M = id("ml1");
  beforeAll(() => {
    addUser(M, "linked@x.test");
    run("update profiles set status = 'approved' where id = ?", M);
  });
  it("only admins mint, list, revoke and read reviews", () => {
    for (const who of [null, M, C]) {
      throwsAccess(() => mintReviewLink(as(who), { member_id: M }));
      throwsAccess(() => revokeReviewLink(as(who), { member_id: M }));
      throwsAccess(() => reviewLinkStates(as(who)));
      throwsAccess(() => adminReviews(as(who)));
      throwsAccess(() => markReviewDone(as(who), { id: "x" }));
      throwsAccess(() => mintReviewLink(as(who), { member_id: M, purpose: "spotlight" }));
      throwsAccess(() => revokeReviewLink(as(who), { member_id: M, purpose: "spotlight" }));
      throwsAccess(() => reviewLinkStates(as(who), { purpose: "spotlight" }));
      throwsAccess(() => adminSpotlights(as(who)));
    }
  });
  it("a Spotlight link opens only the Spotlight form, once, and never approves anyone", () => {
    const token = new URL(mintReviewLink(as(A), { member_id: M, purpose: "spotlight" }).url).searchParams.get("t")!;
    expect(openReview(anon(), { token })).toBeNull();
    expect(openSpotlight(anon(), { token })).not.toBeNull();
    const story = { q_what_inspired_you_to_start: "a", q_what_are_you_currently_focused_on: "b", q_what_are_you_most_proud_of: "c", q_one_fact_others_should_know: "d" };
    submitSpotlight(anon(), { token, full_name: "Mo", ...story, status: "approved", member_id: C });
    expect(openSpotlight(anon(), { token })).toBeNull();
    expect(adminSpotlights(as(A)).find((s) => s.full_name === "Mo")).toMatchObject({ member_id: M, imported: false });
    expect(status(C)).toBe("pending");
  });
  it("a link opens only its member's form, once, and never approves anyone", () => {
    expect(() => mintReviewLink(as(A), { member_id: C })).toThrow(/approved members/);
    const token = new URL(mintReviewLink(as(A), { member_id: M }).url).searchParams.get("t")!;
    expect(openReview(anon(), { token })!.values.email).toBe("linked@x.test");
    submitReview(anon(), { token, full_name: "Mo", email: "linked@x.test", membership: "keep" });
    expect(openReview(anon(), { token })).toBeNull();
    expect(status(M)).toBe("approved");
    expect(status(C)).toBe("pending");
  });
});

// ---------- Custom forms (migration 0005): anyone answers an open form; only admins read the answers ----------
describe("custom forms", () => {
  beforeAll(() => {
    for (const form of DEMO_FORMS) saveForm(db, form);
  });
  it("anon reads an open form and answers it; nobody answers a closed one", () => {
    expect(openForm(anon(), { slug: "salon-rsvp" })!.questions.length).toBeGreaterThan(0);
    submitResponse(anon(), "salon-rsvp", { answers: { name: "Vi", email: "vi-form@x.test", coming: "yes" } });
    expect(() => submitResponse(as(A), "old-survey", { answers: { feedback: "Hi" } })).toThrow(/closed/);
  });
  it("an answer cannot pick its form, version or stored email", () => {
    submitResponse(anon(), "salon-rsvp", { answers: { name: "Sly", email: "sly-form@x.test", coming: "no" }, form_id: "demo0002", form_version: 9, email: "x@x.test" });
    expect(get("select form_id, form_version, email from custom_form_responses where email = 'sly-form@x.test'"))
      .toEqual({ form_id: "demo0001", form_version: 1, email: "sly-form@x.test" });
  });
  it.each([["anon", null], ["pending member", C], ["approved member", B]])("%s cannot read form answers, open/close, edit or download CSV", (_who, who) => {
    throwsAccess(() => adminFormResponses(as(who)));
    throwsAccess(() => setFormOpen(as(who), { id: "demo0001", open: false }));
    throwsAccess(() => saveAdminForm(as(who), { name: "X", slug: "x-form", questions: [{ key: "a", type: "short", label: "A" }] }));
    throwsAccess(() => formResponsesCsv(as(who), { id: "demo0001" }));
  });
  it("admin reads every answer, may close a form, edit it and download its CSV", () => {
    expect(adminFormResponses(as(A)).find((f) => f.slug === "salon-rsvp")!.total).toBe(2);
    setFormOpen(as(A), { id: "demo0001", open: false, message: "Closed by admin." });
    expect(openForm(anon(), { slug: "salon-rsvp" })!.closed).toBe("Closed by admin.");
    setFormOpen(as(A), { id: "demo0001", open: true });
    expect(formResponsesCsv(as(A), { id: "demo0001" }).csv).toContain("Received (UTC)");
    const { id } = saveAdminForm(as(A), {
      name: "Policy form", slug: "policy-form", open: true,
      questions: [{ key: "note", type: "paragraph", label: "Note", required: true }],
    });
    expect(openForm(anon(), { slug: "policy-form" })!.questions).toHaveLength(1);
    expect(id).toMatch(/^[a-z0-9]{8}$/);
  });
});

// Admin notes (0006), CSV export and neighborhood correction: admins only; a member or visitor can neither read, add,
// delete, download nor set anyone's neighborhood (not even her own through this door).
describe("admin notes, CSV export and neighborhood correction", () => {
  it("are admin-only", () => {
    const note = addNote(as(A), { memberId: A, body: "Met at the salon" });
    for (const who of [anon(), as(B), as(C)]) {
      throwsAccess(() => adminNotes(who));
      throwsAccess(() => addNote(who, { memberId: B, body: "x" }));
      throwsAccess(() => deleteNote(who, { id: note }));
      throwsAccess(() => adminCsv(who, { kind: "members" }));
      throwsAccess(() => setMemberNeighborhood(who, { id: B, neighborhood: "Astoria" }));
      throwsAccess(() => adminActions(who));
    }
    expect(adminActions(as(A)).some((a) => a.action === "note_added" && a.member_id === A)).toBe(true);
    expect(adminNotes(as(A)).map((n) => n.id)).toContain(note);
    deleteNote(as(A), { id: note });
    expect(adminNotes(as(A)).map((n) => n.id)).not.toContain(note);
  });
});

describe("logged actions and newsletter subscribers", () => {
  it("are admin-only", () => {
    const action = addLoggedAction(as(A), { memberId: A, kind: "call", actionDate: "2026-11-09", note: "Check-in" });
    for (const who of [anon(), as(B), as(C)]) {
      throwsAccess(() => adminLoggedActions(who));
      throwsAccess(() => addLoggedAction(who, { memberId: B, kind: "call", actionDate: "2026-11-09" }));
      throwsAccess(() => editLoggedAction(who, { id: action, kind: "meeting", actionDate: "2026-11-10" }));
      throwsAccess(() => removeLoggedAction(who, { id: action }));
      throwsAccess(() => restoreLoggedAction(who, { id: action }));
      throwsAccess(() => adminNewsletterSubscribers(who));
    }
    expect(adminLoggedActions(as(A)).some((a) => a.id === action)).toBe(true);
    removeLoggedAction(as(A), { id: action });
    restoreLoggedAction(as(A), { id: action });
    expect(adminNewsletterSubscribers(as(A))).toEqual(expect.any(Array));
  });
});

/** Every server function the browser can call, by export name. */
async function serverFunctionNames(): Promise<string[]> {
  const modules = await Promise.all([
    import("@/features/auth/fns"), import("@/features/members/fns"), import("@/features/events/fns"),
    import("@/features/applications/fns"), import("@/features/neighborhoods/fns"), import("@/features/admin/fns"),
    import("@/features/admin/approval-email"), import("@/features/member-links/fns"), import("@/features/forms/fns"),
  ]);
  return modules.flatMap((m) => Object.keys(m));
}

// Last, so its user and applications shift no fixture above. /account's locked panel offers /join only to someone
// with no application of her own; an unlinked one with the same email doesn't count, and nobody sees anyone else's.
describe("own profile: hasApplication", () => {
  it("is true only once an application is linked to her", () => {
    const H = id("ab0");
    addUser(H, "applies@x.test");
    apply(null, "applies@x.test", "Same Email, Not Linked");
    expect(ownProfile(as(H))!.hasApplication).toBe(false);
    expect(ownProfile(as(C))!.hasApplication).toBe(false);
    apply(H, "applies@x.test", "Hana");
    expect(ownProfile(as(H))!.hasApplication).toBe(true);
    expect(ownProfile(as(C))!.hasApplication).toBe(false);
    throwsAccess(() => ownProfile(anon()));
  });
});
