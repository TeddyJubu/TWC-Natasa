/**
 * The private preview's demo community: exactly 100 made-up members ("… (Demo)", demo-NNN@demo.twc.invalid) with
 * stock portraits, newsfeed posts, photos, loves, replies and applications (src/server/demo-seed.ts). Demo members
 * are public on /members, so remove them before SITE_PIN is lifted (README "Demo data"). Runs on Node:
 *
 *   node --experimental-strip-types scripts/seed-demo.ts [--db <twc.db>] [--cache <dir>] [--password <pw>]
 *        [--dry-run] [--remove | --reseed | --check] [--confirm] [--offline]
 *
 * `--db` defaults to ${DATA_DIR:-./data}/twc.db and `--cache` to ${DATA_DIR}/demo-cache (outside uploads/, so /media
 * never serves it). The password comes from --password or DEMO_PASSWORD, else a random one is printed once. A
 * database with any real account needs --confirm. --check exits 1 while demo rows exist.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { hashPassword } from "better-auth/crypto";
import { dataDir, openDb } from "../src/server/db.ts";
import {
  DEMO_COUNT, demoCounts, hasDemo, photoFile, planDemo, portraitFile, readCache, realUsers, removeDemo, seedDemo,
  type CacheManifest, type DemoFixtures, type DemoPlan,
} from "../src/server/demo-seed.ts";
import { checkImage, MAX_FEED_IMAGE_EDGE } from "../src/server/media.ts";

const { values: o } = parseArgs({
  options: {
    db: { type: "string" }, cache: { type: "string" }, password: { type: "string" },
    "dry-run": { type: "boolean" }, remove: { type: "boolean" }, reseed: { type: "boolean" }, check: { type: "boolean" },
    confirm: { type: "boolean" }, offline: { type: "boolean" },
  },
});
const dbPath = o.db ?? join(dataDir(), "twc.db");
const cache = o.cache ?? join(dataDir(), "demo-cache");
if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
const db = openDb(dbPath);
const show = (counts: Record<string, number>) => Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(", ");
const fail = (message: string): never => { console.error(message); process.exit(1); };

const real = realUsers(db);
console.log(`${dbPath}: ${real} real account(s); demo rows: ${show(demoCounts(db))}`);

if (o.check) process.exit(hasDemo(db) ? 1 : 0);

if (!o["dry-run"] && real > 0 && !o.confirm) {
  fail(`This database has ${real} real account(s). Back it up, then re-run with --confirm.`);
}

if (o.remove) {
  if (o["dry-run"]) { console.log("DRY RUN: would remove the demo rows above and their upload folders."); process.exit(0); }
  console.log(`removed: ${show(removeDemo(db))}`);
  process.exit(0);
}

if (hasDemo(db) && !o.reseed) fail("Demo rows already exist: run with --remove first, or --reseed to replace them.");

const fixtures = JSON.parse(readFileSync(new URL("./fixtures/demo-seed.json", import.meta.url), "utf8")) as DemoFixtures;
const neighborhoods = (db.prepare("select name from neighborhoods where active = 1 order by sort_order").all() as { name: string }[]).map((r) => r.name);
const plan = planDemo(fixtures, neighborhoods, Date.now());
const tally = (xs: { status: string }[]) => ["approved", "pending", "declined"].map((s) => `${s} ${xs.filter((m) => m.status === s).length}`).join(", ");
console.log(`plan: ${plan.members.length} members (${tally(plan.members)}), ${plan.members.filter((m) => !m.portrait).length} without a portrait, `
  + `${plan.posts.length} posts (${plan.posts.filter((p) => p.photos.length).length} with photos), ${plan.loves.length} loves, `
  + `${plan.replies.length} replies, ${plan.members.length + plan.extraApplications.length} applications`);
if (o["dry-run"]) { console.log(`DRY RUN: nothing written${o.reseed ? " (would remove the demo rows first)" : ""}.`); process.exit(0); }

await fillCache(plan);
const media = readCache(cache, plan);
const password = o.password ?? process.env.DEMO_PASSWORD ?? randomBytes(15).toString("base64url");
if (password.length < 8) fail("The demo password needs at least 8 characters.");
const hash = await hashPassword(password);
if (o.reseed) console.log(`removed: ${show(removeDemo(db))}`);
console.log(`seeded: ${show(seedDemo(db, plan, media, hash))}`);
console.log(`Sign in as demo-001@demo.twc.invalid … demo-${String(DEMO_COUNT).padStart(3, "0")}@demo.twc.invalid`
  + (o.password || process.env.DEMO_PASSWORD ? " with the password you gave." : ` with this password (shown once): ${password}`));

/** Downloads what the plan needs into the cache once (Node's fetch follows Picsum's redirect); every file is checked. */
async function fillCache(plan: DemoPlan): Promise<void> {
  const get = async (url: string) => {
    if (o.offline) fail(`--offline: ${url} is not in ${cache}.`);
    const res = await fetch(url, { headers: { "User-Agent": "twc-demo-seed" } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res;
  };
  const save = (file: string, bytes: Uint8Array, maxEdge?: number) => {
    checkImage(bytes, maxEdge);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  };
  for (const m of plan.members) {
    const file = portraitFile(cache, m.index);
    if (m.portrait && !existsSync(file)) save(file, new Uint8Array(await (await get(`https://randomuser.me/api/portraits/women/${m.index}.jpg`)).arrayBuffer()));
  }
  const manifestPath = join(cache, "manifest.json");
  if (!existsSync(manifestPath)) {
    const list: { id: string; author: string }[] = [];
    for (const page of [1, 2]) list.push(...(await (await get(`https://picsum.photos/v2/list?page=${page}&limit=100`)).json()) as typeof list);
    const manifest: CacheManifest = { photos: list.slice(0, 60).map((p) => ({ id: Number(p.id), author: String(p.author).slice(0, 80) })) };
    mkdirSync(cache, { recursive: true });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as CacheManifest;
  for (const p of manifest.photos) {
    const file = photoFile(cache, p.id);
    if (!existsSync(file)) save(file, new Uint8Array(await (await get(`https://picsum.photos/id/${p.id}/1200/900.jpg`)).arrayBuffer()), MAX_FEED_IMAGE_EDGE);
  }
}
