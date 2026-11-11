// The preview's demo community (src/server/demo-seed.ts, scripts/seed-demo.ts) on a throwaway database: exactly 100
// marked members, the catalogue block and its rewind, and real rows byte-identical after seed and after remove.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TINY, WITH_GPS } from "@/test/images";
import { openDb, type DB } from "./db";
import { mediaFile, writeMedia } from "./media";
import {
  checkDemoBeforeLaunch, DEMO_COUNT, demoCounts, hasDemo, photoFile, planDemo, portraitFile, realUsers, removeDemo, seedDemo,
  type DemoFixtures, type DemoMedia,
} from "./demo-seed";

const fixtures = JSON.parse(readFileSync("scripts/fixtures/demo-seed.json", "utf8")) as DemoFixtures;
const NOW = Date.parse("2026-11-11T12:00:00.000Z");
const HOODS = ["Long Island City", "Astoria", "Sunnyside", "Jackson Heights", "Elmhurst", "Forest Hills", "Rego Park"];
const REAL = "00000000-0000-4000-8000-0000000000a1";
const REAL_PENDING = "00000000-0000-4000-8000-0000000000a2";
const media: DemoMedia = {
  portraits: Array.from({ length: DEMO_COUNT }, () => TINY.jpg),
  photos: [{ id: 1, author: "Ada Photographer", bytes: WITH_GPS.jpg }, { id: 2, author: "Bea Lens", bytes: TINY.png }],
};
let dir: string;
let db: DB;

/** Every row of the tables the seed could touch that isn't a demo one, as one string. */
function realRows(db: DB): string {
  const demo = `(select id from "user" where lower(email) like '%@demo.twc.invalid')`;
  const q = (sql: string) => db.prepare(sql).all();
  return JSON.stringify({
    user: q(`select * from "user" where id not in ${demo} order by id`),
    account: q(`select * from account where userId not in ${demo} order by id`),
    session: q(`select * from session where userId not in ${demo} order by id`),
    profiles: q(`select * from profiles where id not in ${demo} order by id`),
    roles: q(`select * from user_roles where user_id not in ${demo} order by user_id, role`),
    applications: q("select * from applications where lower(email) not like '%@demo.twc.invalid' order by id"),
    posts: q(`select * from feed_posts where author_id not in ${demo} order by id`),
    loves: q(`select * from feed_loves where member_id not in ${demo} order by post_id, member_id`),
    replies: q(`select * from feed_replies where author_id not in ${demo} order by id`),
    legacy: q("select * from legacy_members order by legacy_id"),
    newsletter: q("select * from newsletter_subscribers order by id"),
    inbox: q("select * from inbox_messages order by id"),
    actions: q("select * from admin_actions order by id"),
    neighborhoods: q("select * from neighborhoods order by slug"),
  });
}
const seq = () => (db.prepare("select last from catalogue_seq").get() as { last: number }).last;
const one = <T>(sql: string, ...args: (string | number)[]) => db.prepare(sql).get(...args) as T;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "twc-demo-"));
  vi.stubEnv("DATA_DIR", dir);
});
afterAll(() => vi.unstubAllEnvs());

beforeEach(() => {
  db = openDb(":memory:");
  const at = "2025-01-01T00:00:00.000Z";
  const user = db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, ?, ?, 1, ?, ?)`);
  user.run(REAL, "Real Admin", "admin@example.org", at, at);
  user.run(REAL_PENDING, "Real Applicant", "applicant@example.org", at, at);
  db.prepare("insert into user_roles (user_id, role) values (?, 'admin')").run(REAL);
  db.prepare("update profiles set status = 'approved', directory_visible = 1, public_profile = 1, updated_at = ? where id = ?").run(at, REAL);
  db.prepare("insert into applications (email, full_name, answers, created_at) values ('walkin@example.org', 'Walk In', '{}', ?)").run(at);
  db.prepare("insert into feed_posts (id, author_id, kind, body, created_at) values ('real-post', ?, 'update', 'Hello', ?)").run(REAL, at);
  writeMedia("avatars", `${REAL}/avatar-1.jpg`, TINY.jpg);
});

describe("planDemo", () => {
  const plan = planDemo(fixtures, HOODS, NOW);

  it("is the same community every run", () => {
    expect(planDemo(fixtures, HOODS, NOW)).toEqual(plan);
  });

  it("plans exactly 100 marked members in the documented mix, with initials from her own name", () => {
    expect(plan.members).toHaveLength(100);
    expect(new Set(plan.members.map((m) => m.name)).size).toBe(100);
    for (const m of plan.members) {
      expect(m.name).toMatch(/^\S+ \S+ \(Demo\)$/);
      expect(m.email).toMatch(/^demo-\d{3}@demo\.twc\.invalid$/);
      // The tag comes last, so the initials mat (first two words) shows her initials, never "D".
      expect(m.name.split(" ").slice(0, 2).join(" ")).not.toContain("(");
      expect(m.bio.length).toBeLessThanOrEqual(400);
      expect(m.lookingFor.length).toBeLessThanOrEqual(160);
      expect(m.specialty.length).toBeLessThanOrEqual(80);
    }
    const count = (f: (m: (typeof plan.members)[number]) => boolean) => plan.members.filter(f).length;
    expect(count((m) => m.status === "approved" && m.public)).toBe(80);
    expect(count((m) => m.status === "approved" && m.listed && !m.public)).toBe(8);
    expect(count((m) => m.status === "approved" && !m.listed)).toBe(4);
    expect([count((m) => m.status === "pending"), count((m) => m.status === "declined")]).toEqual([5, 3]);
    expect(count((m) => !m.portrait)).toBe(10);
    expect(count((m) => m.neighborhood === null)).toBe(8);
  });

  it("plans about 160 posts over 60 days, 20-odd this week, some photo-only, none before her approval", () => {
    expect(plan.posts).toHaveLength(160);
    const week = plan.posts.filter((p) => NOW - Date.parse(p.createdAt) < 7 * 86_400_000).length;
    expect(week).toBeGreaterThanOrEqual(20);
    expect(plan.posts.filter((p) => p.photos.length > 0).length).toBeGreaterThanOrEqual(40);
    expect(plan.posts.filter((p) => p.body === "").length).toBe(4);
    for (const p of plan.posts) {
      const author = plan.members[p.author];
      expect(author.status).toBe("approved");
      expect(Date.parse(p.createdAt)).toBeGreaterThan(Date.parse(author.memberSince!));
      expect(p.photos.length).toBeLessThanOrEqual(4);
    }
    for (const r of plan.replies) expect(Date.parse(r.createdAt)).toBeGreaterThan(Date.parse(plan.posts[r.post].createdAt));
  });
});

describe("seedDemo and removeDemo", () => {
  it("adds the community without touching a real row, and removes every demo row and file again", () => {
    const before = realRows(db);
    const lastBefore = seq();
    const plan = planDemo(fixtures, HOODS, NOW);
    const counts = seedDemo(db, plan, media, "hash");
    expect(counts).toMatchObject({ users: 100, accounts: 100, profiles: 100, roles: 100, applications: 107, posts: 160 });
    expect(realRows(db)).toBe(before);

    // Members only, never an admin; a contiguous catalogue block after every real number.
    expect(one<{ n: number }>(`select count(*) as n from user_roles where role = 'admin' and user_id <> ?`, REAL).n).toBe(0);
    const block = one<{ lo: number; hi: number; n: number }>(
      "select min(catalogue_number) as lo, max(catalogue_number) as hi, count(catalogue_number) as n from profiles where id <> ?", REAL);
    const realNumber = one<{ c: number }>("select catalogue_number as c from profiles where id = ?", REAL).c;
    expect(block).toEqual({ lo: realNumber + 1, hi: realNumber + 92, n: 92 });
    expect(seq()).toBe(realNumber + 92);
    // Backdated approvals keep their date; nobody is subscribed to anything.
    expect(one<{ n: number }>("select count(*) as n from profiles where status = 'approved' and member_since >= '2026-09-01' and id <> ?", REAL).n).toBe(0);
    expect(one<{ n: number }>("select count(*) as n from applications where json_extract(answers, '$.newsletter.subscribe') = 1").n).toBe(0);
    expect(one<{ n: number }>("select count(*) as n from newsletter_subscribers").n).toBe(0);
    // One pending duplicate of an approved demo member's address, unclaimed.
    expect(one<{ n: number }>("select count(*) as n from applications where email = 'demo-001@demo.twc.invalid' and user_id is null and status = 'pending'").n).toBe(1);
    // No demo love or reply on a real member's post.
    expect(one<{ n: number }>("select (select count(*) from feed_loves where post_id = 'real-post') + (select count(*) from feed_replies where post_id = 'real-post') as n").n).toBe(0);

    // Files: portraits in her folder, feed photos named for their post, metadata stripped.
    const withAvatar = db.prepare("select id, avatar_path from profiles where avatar_path is not null and id <> ?").all(REAL) as { id: string; avatar_path: string }[];
    expect(withAvatar).toHaveLength(90);
    for (const p of withAvatar) expect(existsSync(mediaFile("avatars", p.avatar_path)!)).toBe(true);
    const photos = (db.prepare("select id, author_id, photos from feed_posts where photos <> '[]'").all() as { id: string; author_id: string; photos: string }[]);
    expect(photos.length).toBeGreaterThanOrEqual(40);
    for (const post of photos) {
      for (const [n, photo] of (JSON.parse(post.photos) as { name: string; alt: string }[]).entries()) {
        expect(photo.name).toMatch(new RegExp(`^${post.author_id}/${post.id}-${n + 1}\\.(jpg|png)$`));
        expect(photo.alt).toMatch(/^Stock photo by (Ada Photographer|Bea Lens) \(Unsplash via Picsum\)$/);
        const stored = readFileSync(mediaFile("feed", photo.name)!);
        expect(stored.includes(Buffer.from("GPS"))).toBe(false);
      }
    }
    const demoIds = (db.prepare(`select id from "user" where email like '%@demo.twc.invalid'`).all() as { id: string }[]).map((r) => r.id);

    // A second seed refuses; remove clears everything; a second remove is a no-op.
    expect(() => seedDemo(db, plan, media, "hash")).toThrow(/already exist/);
    removeDemo(db);
    expect(hasDemo(db)).toBe(false);
    expect(Object.values(demoCounts(db)).every((n) => n === 0)).toBe(true);
    expect(one<{ n: number }>("select count(*) as n from applications where email like '%@demo.twc.invalid'").n).toBe(0);
    for (const id of demoIds) {
      expect(existsSync(join(dir, "uploads", "avatars", id))).toBe(false);
      expect(existsSync(join(dir, "uploads", "feed", id))).toBe(false);
    }
    expect(existsSync(mediaFile("avatars", `${REAL}/avatar-1.jpg`)!)).toBe(true);
    expect(realRows(db)).toBe(before);
    expect(seq()).toBe(lastBefore);
    expect(removeDemo(db)).toMatchObject({ users: 0, folders: 0 });
    expect(realUsers(db)).toBe(2);
  });

  it("never reuses a number: a real member approved during the demo keeps hers, and the sequence stays past it", () => {
    seedDemo(db, planDemo(fixtures, HOODS, NOW), media, "hash");
    const hi = seq();
    db.prepare("update profiles set status = 'approved' where id = ?").run(REAL_PENDING);
    expect(one<{ c: number }>("select catalogue_number as c from profiles where id = ?", REAL_PENDING).c).toBe(hi + 1);
    removeDemo(db);
    expect(one<{ c: number }>("select catalogue_number as c from profiles where id = ?", REAL_PENDING).c).toBe(hi + 1);
    expect(seq()).toBe(hi + 1);
  });

  it("cleans up the files it wrote when the insert fails", () => {
    db.exec(`create trigger no_posts before insert on feed_posts begin select raise(abort, 'nope'); end`);
    expect(() => seedDemo(db, planDemo(fixtures, HOODS, NOW), media, "hash")).toThrow(/nope/);
    expect(hasDemo(db)).toBe(false);
    const folders = (["avatars", "feed"] as const).flatMap((b) => {
      const root = join(dir, "uploads", b);
      return existsSync(root) ? readdirSync(root) : [];
    });
    expect(folders.filter((id) => id !== REAL)).toEqual([]);
  });
});

describe("scripts/seed-demo.ts", () => {
  it("dry-runs, seeds from the cache offline, reports through --check, refuses twice, and removes", () => {
    const data = mkdtempSync(join(tmpdir(), "twc-demo-cli-"));
    const cache = join(data, "demo-cache");
    for (let i = 0; i < DEMO_COUNT; i++) { mkdirSync(join(cache, "portraits"), { recursive: true }); writeFileSync(portraitFile(cache, i), TINY.jpg); }
    mkdirSync(join(cache, "photos"), { recursive: true });
    writeFileSync(photoFile(cache, 7), WITH_GPS.jpg);
    writeFileSync(join(cache, "manifest.json"), JSON.stringify({ photos: [{ id: 7, author: "Ada Photographer" }] }));
    const run = (...args: string[]) => spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/seed-demo.ts", ...args],
      { encoding: "utf8", env: { ...process.env, DATA_DIR: data, DEMO_PASSWORD: "" } });

    for (const mode of ["--check", "--remove", "--dry-run"]) {
      const missing = run(mode);
      expect(missing.status).toBe(1);
      expect(missing.stderr).toContain("No database at");
    }
    expect(existsSync(join(data, "twc.db"))).toBe(false);
    openDb(join(data, "twc.db")).close();

    const dry = run("--dry-run");
    expect(dry.status).toBe(0);
    expect(dry.stdout).toContain("plan: 100 members (approved 92, pending 5, declined 3)");
    expect(dry.stdout).toContain("DRY RUN");
    expect(run("--check").status).toBe(0);

    const seeded = run("--offline", "--password", "demo-test-pass");
    expect(seeded.status, seeded.stderr).toBe(0);
    expect(seeded.stdout).toContain("seeded: users 100");
    expect(seeded.stdout).not.toContain("demo-test-pass");
    expect(run("--check").status).toBe(1);
    const again = run("--offline", "--password", "demo-test-pass");
    expect(again.status).toBe(1);
    expect(again.stderr).toContain("--remove first");

    const db2 = openDb(join(data, "twc.db"));
    const hash = (db2.prepare("select password from account limit 1").get() as { password: string }).password;
    expect(hash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/); // Better Auth's scrypt salt:key, never the password
    db2.close();

    const reseeded = run("--offline", "--reseed"); // DEMO_PASSWORD is empty and no --password: a random one
    expect(reseeded.status, reseeded.stderr).toBe(0);
    expect(reseeded.stdout).toContain("with this password (shown once): ");

    expect(run("--remove").status).toBe(0);
    expect(run("--check").status).toBe(0);
  }, 60_000);

  it("needs --confirm on a database with real accounts", () => {
    const data = mkdtempSync(join(tmpdir(), "twc-demo-real-"));
    const real = openDb(join(data, "twc.db"));
    real.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, 'R', 'r@example.org', 1, 'x', 'x')`).run(REAL);
    real.close();
    const out = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/seed-demo.ts", "--remove"],
      { encoding: "utf8", env: { ...process.env, DATA_DIR: data } });
    expect(out.status).toBe(1);
    expect(out.stderr).toContain("--confirm");
    expect(out.stdout).toContain("1 real account(s)");
  });
});

describe("checkDemoBeforeLaunch", () => {
  it("refuses a production start without SITE_PIN while a demo account exists, and nothing else", () => {
    const db = openDb(":memory:");
    const prod = { NODE_ENV: "production" };
    expect(() => checkDemoBeforeLaunch(db, prod)).not.toThrow();
    db.prepare(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values ('d1', 'Ada (Demo)', 'demo-001@demo.twc.invalid', 1, 0, 0)`).run();
    expect(() => checkDemoBeforeLaunch(db, prod)).toThrow(/seed-demo\.ts --remove before lifting SITE_PIN/);
    expect(() => checkDemoBeforeLaunch(db, { ...prod, SITE_PIN: "1234" })).not.toThrow();
    expect(() => checkDemoBeforeLaunch(db, { NODE_ENV: "development" })).not.toThrow();
  });

  it("runs when the server starts", () =>
    expect(readFileSync("src/server.ts", "utf8")).toMatch(/^checkDemoBeforeLaunch\(getDb\(\)\);$/m));
});
