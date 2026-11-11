// Server-only: the private preview's demo community (scripts/seed-demo.ts). Exactly 100 made-up members, each named
// "<First> <Last> (Demo)" with the email demo-NNN@demo.twc.invalid (.invalid never receives mail), their portraits,
// newsfeed posts with photos, loves, replies and applications. The email domain is the only marker and the only key
// removal uses, so a real row is never read for writing, updated or deleted: every write is an insert of a new demo
// id, or an update/delete filtered to demo ids. It never creates an admin role, admin actions, newsletter subscribers,
// inbox messages or legacy members, and never sends mail or calls Beehiiv. Demo members are public (/members, the
// sitemap, /media/public), so they must be removed before SITE_PIN is lifted (AGENTS.md, README "Demo data").
// Relative `.ts` imports only, so the script runs it under plain Node.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tx, type DB } from "./db.ts";
import { checkImage, MAX_FEED_IMAGE_EDGE, mediaFile, writeMedia, type Bucket } from "./media.ts";

export const DEMO_DOMAIN = "demo.twc.invalid";
export const DEMO_COUNT = 100;
export const DEMO_SUFFIX = " (Demo)";
/** SQL: is this email a demo one? */
const IS_DEMO_EMAIL = `lower(email) like '%@${DEMO_DOMAIN}'`;
const DEMO_IDS = `select id from "user" where ${IS_DEMO_EMAIL}`;
const BUCKETS: Bucket[] = ["avatars", "feed"];

export const demoEmail = (i: number) => `demo-${String(i + 1).padStart(3, "0")}@${DEMO_DOMAIN}`;
export const isDemoEmail = (email: string) => email.toLowerCase().endsWith(`@${DEMO_DOMAIN}`);

export type DemoFixtures = {
  firstNames: string[];
  lastNames: string[];
  roles: { role: string; business: string; specialty: string }[];
  bios: string[];
  lookingFor: string[];
  posts: Record<"update" | "ask" | "offer" | "gathering", string[]>;
  replies: string[];
  applicants: { first: string; last: string; role: string; business: string }[];
};

export type Kind = keyof DemoFixtures["posts"];
export type Status = "approved" | "pending" | "declined";

export type PlannedMember = {
  index: number; name: string; email: string; status: Status; listed: boolean; public: boolean; portrait: boolean;
  neighborhood: string | null; role: string; business: string; specialty: string; bio: string; lookingFor: string; website: string;
  cardColor: string; memberSince: string | null; createdAt: string; reviewedAt: string | null;
};
export type PlannedPost = { author: number; kind: Kind; body: string; createdAt: string; photos: number[] };
export type DemoPlan = {
  members: PlannedMember[];
  posts: PlannedPost[];
  loves: { post: number; member: number; createdAt: string }[];
  replies: { post: number; author: number; body: string; createdAt: string }[];
  /** Applications without an account (demo-app-NN@…), plus one duplicate of an approved demo member's email. */
  extraApplications: { email: string; fullName: string; neighborhood: string; role: string; business: string; createdAt: string }[];
};

/** A seeded PRNG (mulberry32), so a re-run plans the same community. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 24 * 60 * 60 * 1000;
const COLORS = ["mustard", "rose", "lilac", "mint"];
const KIND_WEIGHTS: [Kind, number][] = [["update", 45], ["ask", 20], ["offer", 20], ["gathering", 15]];
export const POSTS = 160;
const RECENT_POSTS = 22; // in the last seven days, so the week's tally and the paging past 20 have something to show
const PHOTO_ONLY_POSTS = 4;

/**
 * The mix by index: 0–79 approved, listed and public; 80–87 approved and listed only (/directory, not /members);
 * 88–91 approved but unlisted (they post under their initials); 92–96 pending; 97–99 declined.
 */
export function mixOf(i: number): Pick<PlannedMember, "status" | "listed" | "public"> {
  if (i < 80) return { status: "approved", listed: true, public: true };
  if (i < 88) return { status: "approved", listed: true, public: false };
  if (i < 92) return { status: "approved", listed: false, public: false };
  return { status: i < 97 ? "pending" : "declined", listed: false, public: false };
}
/** Ten approved members have no portrait (the initials mat); the rest use stock portrait `i`. */
export const hasPortrait = (i: number) => !(i < 92 && i % 9 === 4);

const fill = (text: string, v: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");
const slugify = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The whole community, from the fixtures, the active neighborhoods and the time (pure: same input, same plan). */
export function planDemo(f: DemoFixtures, neighborhoods: string[], nowMs: number): DemoPlan {
  const rand = prng(2026);
  const int = (n: number) => Math.floor(rand() * n);
  const pick = <T>(xs: T[]) => xs[int(xs.length)];
  const iso = (ms: number) => new Date(Math.floor(ms)).toISOString();
  const between = (from: number, to: number) => from + rand() * (to - from);
  const lasts = [...f.lastNames];
  for (let i = lasts.length - 1; i > 0; i--) { const j = int(i + 1); [lasts[i], lasts[j]] = [lasts[j], lasts[i]]; }

  const members: PlannedMember[] = [];
  for (let i = 0; i < DEMO_COUNT; i++) {
    const first = f.firstNames[i % f.firstNames.length];
    const last = lasts[i % lasts.length];
    const mix = mixOf(i);
    // About eight without a neighborhood, so "Where you belong" drops its row; the rest round-robin.
    const neighborhood = i % 12 === 11 || neighborhoods.length === 0 ? null : neighborhoods[i % neighborhoods.length];
    const hood = neighborhood ?? "Queens";
    const r = f.roles[i % f.roles.length];
    const v = { first, last, hood };
    const business = fill(r.business, v);
    const joined = between(Date.UTC(2022, 0, 10), nowMs - 75 * DAY);
    const createdAt = mix.status === "pending" ? iso(nowMs - between(3, 20) * DAY)
      : mix.status === "declined" ? iso(nowMs - between(60, 200) * DAY) : iso(joined - between(3, 14) * DAY);
    members.push({
      index: i, name: `${first} ${last}${DEMO_SUFFIX}`, email: demoEmail(i), ...mix, portrait: hasPortrait(i), neighborhood,
      role: r.role, business, specialty: r.specialty, bio: fill(pick(f.bios), { ...v, business }).slice(0, 400),
      lookingFor: pick(f.lookingFor).slice(0, 160), website: i % 5 === 3 ? "" : `https://example.com/${slugify(`${first}-${last}`)}`,
      cardColor: pick(COLORS), memberSince: mix.status === "approved" ? iso(joined) : null, createdAt,
      reviewedAt: mix.status === "approved" ? iso(joined) : mix.status === "declined" ? iso(Date.parse(createdAt) + between(2, 9) * DAY) : null,
    });
  }

  const authors = members.filter((m) => m.status === "approved").map((m) => m.index);
  const total = KIND_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  const kindOf = () => { let x = rand() * total; for (const [k, w] of KIND_WEIGHTS) if ((x -= w) < 0) return k; return "update" as Kind; };
  const posts: PlannedPost[] = [];
  for (let p = 0; p < POSTS; p++) {
    const author = members[pick(authors)];
    const kind = kindOf();
    const ago = p < RECENT_POSTS ? between(0.05, 6.8) : between(7.2, 60);
    const photoCount = p % 7 === 1 || p % 7 === 4 ? 1 + int(4) : 0; // 46 of 160
    const photoOnly = photoCount > 0 && posts.filter((x) => x.body === "").length < PHOTO_ONLY_POSTS && int(5) === 0;
    posts.push({
      author: author.index, kind, createdAt: iso(nowMs - ago * DAY),
      body: photoOnly ? "" : fill(pick(f.posts[kind]), { business: author.business, hood: author.neighborhood ?? "Queens" }),
      photos: Array.from({ length: photoCount }, () => int(1_000_000)),
    });
  }
  // Make sure the photo-only posts exist even if the dice said no.
  for (const post of posts) {
    if (posts.filter((x) => x.body === "").length >= PHOTO_ONLY_POSTS) break;
    if (post.photos.length > 0 && post.body !== "") post.body = "";
  }

  const loves: DemoPlan["loves"] = [];
  const replies: DemoPlan["replies"] = [];
  posts.forEach((post, p) => {
    const at = Date.parse(post.createdAt);
    const lovers = new Set<number>();
    const wanted = Math.floor(rand() * rand() * 26);
    while (lovers.size < Math.min(wanted, authors.length - 1)) {
      const m = pick(authors);
      if (m !== post.author) lovers.add(m);
    }
    for (const m of lovers) loves.push({ post: p, member: m, createdAt: iso(between(at, nowMs)) });
    const count = Math.floor(rand() * rand() * 6);
    const times = Array.from({ length: count }, () => between(at + 60_000, nowMs)).sort((a, b) => a - b);
    for (const t of times) replies.push({ post: p, author: pick(authors), body: pick(f.replies), createdAt: iso(t) });
  });

  const extraApplications: DemoPlan["extraApplications"] = f.applicants.map((a, n) => ({
    email: `demo-app-${String(n + 1).padStart(2, "0")}@${DEMO_DOMAIN}`, fullName: `${a.first} ${a.last}${DEMO_SUFFIX}`,
    neighborhood: neighborhoods[n % Math.max(neighborhoods.length, 1)] ?? "", role: a.role, business: a.business,
    createdAt: iso(nowMs - between(1, 12) * DAY),
  }));
  // A second, pending application from an approved demo member's address, for the admin's duplicate flag.
  const dup = members[0];
  extraApplications.push({ email: dup.email, fullName: dup.name, neighborhood: dup.neighborhood ?? "", role: dup.role, business: dup.business, createdAt: iso(nowMs - 2 * DAY) });
  return { members, posts, loves, replies, extraApplications };
}

/** The /join answers' shape, honest and short; the newsletter is always declined, so nothing can reach Beehiiv. */
function answersFor(a: { role: string; business: string; story: string; referral: string; neighborhood: string; createdAt: string; name: string }) {
  return {
    phone: "718-555-0100",
    basedIn: a.neighborhood || "Queens",
    connection: ["I live here", "I own a business here"],
    business: a.business || undefined,
    role: a.role,
    story: a.story,
    industry: ["Other"],
    otherIndustry: "Demo data",
    communityGoals: ["Referrals", "Friendship"],
    idealReferral: a.referral,
    memberSupport: ["Give referrals"],
    whatsapp: { join: false },
    spotlight: { choice: "no" },
    directory: { choice: "no" },
    partner: { choice: "no" },
    newsletter: { subscribe: false },
    communityGuidelines: true,
    signature: a.name,
    date: a.createdAt.slice(0, 10),
    finalConfirmation: true,
  };
}

/** Rows that belong to demo accounts (or carry a demo email), per table. */
export function demoCounts(db: DB): Record<string, number> {
  const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  const ids = DEMO_IDS;
  return {
    users: n(`select count(*) as n from "user" where ${IS_DEMO_EMAIL}`),
    accounts: n(`select count(*) as n from account where userId in (${ids})`),
    sessions: n(`select count(*) as n from session where userId in (${ids})`),
    profiles: n(`select count(*) as n from profiles where id in (${ids})`),
    roles: n(`select count(*) as n from user_roles where user_id in (${ids})`),
    applications: n(`select count(*) as n from applications where ${IS_DEMO_EMAIL} or user_id in (${ids})`),
    posts: n(`select count(*) as n from feed_posts where author_id in (${ids})`),
    loves: n(`select count(*) as n from feed_loves where member_id in (${ids}) or post_id in (select id from feed_posts where author_id in (${ids}))`),
    replies: n(`select count(*) as n from feed_replies where author_id in (${ids}) or post_id in (select id from feed_posts where author_id in (${ids}))`),
  };
}
export const hasDemo = (db: DB) => Object.values(demoCounts(db)).some((n) => n > 0);
/** Accounts that aren't demo ones: anything above zero means a real database, which needs --confirm. */
export const realUsers = (db: DB) => (db.prepare(`select count(*) as n from "user" where not (${IS_DEMO_EMAIL})`).get() as { n: number }).n;

export type DemoMedia = {
  /** Stock portrait `i` for demo member `i` (missing ones get the initials mat). */
  portraits: (Uint8Array | undefined)[];
  /** The feed's photo pool, with each photographer's name for the alt text. */
  photos: { id: number; author: string; bytes: Uint8Array }[];
};

const removeFolders = (ids: string[]) => {
  let removed = 0;
  for (const id of ids) {
    for (const bucket of BUCKETS) {
      const file = mediaFile(bucket, `${id}/x`); // validates the id as one plain segment inside the bucket
      if (!file) continue;
      const folder = dirname(file);
      if (existsSync(folder)) { rmSync(folder, { recursive: true, force: true }); removed++; }
    }
  }
  return removed;
};

/**
 * Inserts the planned community. Refuses when demo rows already exist (remove them first). Files are written first and
 * the rows in one transaction; if it throws, every file it wrote is removed again. Approvals run in index order, so
 * the catalogue numbers are one block straight after every real number, handed out by the database's own trigger.
 */
export function seedDemo(db: DB, plan: DemoPlan, media: DemoMedia, passwordHash: string): Record<string, number> {
  if (hasDemo(db)) throw new Error("Demo rows already exist: run --remove first (or --reseed).");
  const ids = plan.members.map(() => randomUUID());
  const postIds = plan.posts.map(() => randomUUID());
  const stamp = Date.now();
  try {
    const avatars = plan.members.map((m, i) => {
      const bytes = m.portrait ? media.portraits[m.index] : undefined;
      if (!bytes) return null;
      const name = `${ids[i]}/avatar-${stamp}.${checkImage(bytes)}`;
      writeMedia("avatars", name, bytes);
      return name;
    });
    const photos = plan.posts.map((post, p) => post.photos.map((seed, n) => {
      if (media.photos.length === 0) throw new Error("No feed photos in the cache.");
      const photo = media.photos[seed % media.photos.length];
      const name = `${ids[post.author]}/${postIds[p]}-${n + 1}.${checkImage(photo.bytes, MAX_FEED_IMAGE_EDGE)}`;
      writeMedia("feed", name, photo.bytes);
      return { name, alt: `Stock photo by ${photo.author} (Unsplash via Picsum)`.slice(0, 300) };
    }));

    tx(db, () => {
      const user = db.prepare(`insert into "user" (id, name, email, emailVerified, image, createdAt, updatedAt) values (?, ?, ?, 1, null, ?, ?)`);
      const account = db.prepare("insert into account (id, accountId, providerId, userId, password, createdAt, updatedAt) values (?, ?, 'credential', ?, ?, ?, ?)");
      const profile = db.prepare(`update profiles set role_title = ?, business = ?, specialty = ?, bio = ?, looking_for = ?, website = ?,
        neighborhood = ?, avatar_path = ?, card_color = ?, directory_visible = ?, public_profile = ?, member_since = ?, created_at = ?, status = ?
        where id = ? and id in (${DEMO_IDS})`);
      const application = db.prepare(`insert into applications (email, full_name, neighborhood, answers, status, user_id, created_at, reviewed_at)
        values (?, ?, ?, ?, ?, ?, ?, ?)`);
      plan.members.forEach((m, i) => {
        user.run(ids[i], m.name, m.email, m.createdAt, m.createdAt);
        account.run(randomUUID(), ids[i], ids[i], passwordHash, m.createdAt, m.createdAt);
        profile.run(m.role, m.business, m.specialty, m.bio, m.lookingFor, m.website, m.neighborhood, avatars[i], m.cardColor,
          m.listed ? 1 : 0, m.public ? 1 : 0, m.memberSince, m.createdAt, m.status, ids[i]);
      });
      // After the accounts, linked by id: the sign-up trigger never claims a demo application by email.
      plan.members.forEach((m, i) => application.run(m.email, m.name, m.neighborhood ?? "", JSON.stringify(answersFor({
        role: m.role, business: m.business, story: m.bio, referral: m.lookingFor, neighborhood: m.neighborhood ?? "", createdAt: m.createdAt, name: m.name,
      })), m.status, ids[i], m.createdAt, m.reviewedAt));
      for (const a of plan.extraApplications) {
        application.run(a.email, a.fullName, a.neighborhood, JSON.stringify(answersFor({
          role: a.role, business: a.business, story: `I would love to meet other women in business in ${a.neighborhood || "Queens"}.`,
          referral: "Introductions to other members.", neighborhood: a.neighborhood, createdAt: a.createdAt, name: a.fullName,
        })), "pending", null, a.createdAt, null);
      }
      const post = db.prepare("insert into feed_posts (id, author_id, kind, body, photos, created_at) values (?, ?, ?, ?, ?, ?)");
      plan.posts.forEach((p, n) => post.run(postIds[n], ids[p.author], p.kind, p.body, JSON.stringify(photos[n]), p.createdAt));
      const love = db.prepare("insert into feed_loves (post_id, member_id, created_at) values (?, ?, ?) on conflict do nothing");
      for (const l of plan.loves) love.run(postIds[l.post], ids[l.member], l.createdAt);
      const reply = db.prepare("insert into feed_replies (id, post_id, author_id, body, created_at) values (?, ?, ?, ?, ?)");
      for (const r of plan.replies) reply.run(randomUUID(), postIds[r.post], ids[r.author], r.body, r.createdAt);
    });
  } catch (error) {
    removeFolders(ids);
    throw error;
  }
  return demoCounts(db);
}

/**
 * Deletes every demo account (its profile, roles, sessions, posts, loves, replies, notes and links cascade), every
 * demo application, and their upload folders, including anything a tester uploaded or posted as a demo. Rewinds the
 * catalogue numbers only when nobody was numbered after the demo block, so no real number is ever reused. A second
 * run is a no-op. Admin activity rows that testers created stay (append-only, shown as removed).
 */
export function removeDemo(db: DB): Record<string, number> & { folders: number } {
  const before = demoCounts(db);
  const ids = (db.prepare(DEMO_IDS).all() as { id: string }[]).map((r) => r.id);
  tx(db, () => {
    const block = db.prepare(`select min(catalogue_number) as lo, max(catalogue_number) as hi from profiles where id in (${DEMO_IDS})`)
      .get() as { lo: number | null; hi: number | null };
    db.prepare(`delete from applications where ${IS_DEMO_EMAIL} or user_id in (${DEMO_IDS})`).run();
    db.prepare(`delete from verification where value in (${DEMO_IDS}) or lower(identifier) like '%@${DEMO_DOMAIN}%'`).run();
    const del = db.prepare(`delete from "user" where id = ? and ${IS_DEMO_EMAIL}`);
    for (const id of ids) del.run(id);
    if (block.lo !== null && block.hi !== null) {
      db.prepare("update catalogue_seq set last = max(?, coalesce((select max(catalogue_number) from profiles), 10)) where last = ?")
        .run(block.lo - 1, block.hi);
    }
  });
  return { ...before, folders: removeFolders(ids) };
}

/** The cache the script fills: portraits/NN.jpg (randomuser women/NN) and photos/<id>.jpg plus manifest.json. */
export type CacheManifest = { photos: { id: number; author: string }[] };
export const portraitFile = (cache: string, i: number) => join(cache, "portraits", `${String(i).padStart(2, "0")}.jpg`);
export const photoFile = (cache: string, id: number) => join(cache, "photos", `${id}.jpg`);

/** Reads the cached images for a plan; throws naming the first one missing. */
export function readCache(cache: string, plan: DemoPlan): DemoMedia {
  const read = (file: string) => {
    if (!existsSync(file)) throw new Error(`Missing ${file}: run without --offline to download it.`);
    return new Uint8Array(readFileSync(file));
  };
  const portraits: (Uint8Array | undefined)[] = [];
  for (const m of plan.members) if (m.portrait) portraits[m.index] = read(portraitFile(cache, m.index));
  const manifestPath = join(cache, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as CacheManifest;
  return { portraits, photos: manifest.photos.map((p) => ({ ...p, bytes: read(photoFile(cache, p.id)) })) };
}
