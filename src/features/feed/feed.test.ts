// The newsfeed's rules (migration 0013, feed.server.ts): who reads and writes, what a post may hold, pages and filters,
// loves, replies, deletes, and what happens to a member's posts and photos when she is no longer in.
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "@/server/db";
import type { Ctx } from "@/server/context.server";
import { mediaFile, serveMedia, writeMedia } from "@/server/media";
import { TINY } from "@/test/images";
import { createPost, deletePost, deleteReply, feed, feedRequest, love, reply, type NewPost } from "./feed.server";

const id = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;
const [ADMIN, BEA, CARA, PENDING] = ["a1", "b1", "c1", "d1"].map(id);
let db: DB;
const as = (who: string | null): Ctx => ({ db, actor: who ? { id: who, email: `${who}@x.test` } : null });
const run = (sql: string, ...a: (string | number | null)[]) => db.prepare(sql).run(...a);
const addUser = (who: string, name: string) => {
  const now = new Date().toISOString();
  run(`insert into "user" (id, name, email, emailVerified, createdAt, updatedAt) values (?, ?, ?, 1, ?, ?)`, who, name, `${who}@x.test`, now, now);
};
const post = (who: string, body: string, extra: Partial<NewPost> = {}) => createPost(as(who), { kind: "update", body, photos: [], ...extra }).id;
const at = (postId: string, iso: string) => run("update feed_posts set created_at = ? where id = ?", iso, postId);
const sees = (who: string | null, url: string) => serveMedia(db, as(who).actor, url).status === 200;
const denied = (fn: () => unknown, re = /sign in|members only|only delete/i) => expect(fn).toThrow(re);

beforeAll(() => {
  vi.stubEnv("DATA_DIR", mkdtempSync(join(tmpdir(), "twc-feed-")));
  db = openDb(":memory:");
  addUser(ADMIN, "Ada");
  addUser(BEA, "Bea");
  addUser(CARA, "Cara");
  addUser(PENDING, "Pia");
  run("insert into user_roles (user_id, role) values (?, 'admin')", ADMIN);
  run("update profiles set status = 'approved', directory_visible = 1, neighborhood = 'Astoria', role_title = 'Baker', business = 'Little Loaf' where id = ?", BEA);
  run("update profiles set status = 'approved', neighborhood = 'Sunnyside' where id = ?", CARA);
});
beforeEach(() => run("delete from feed_posts"));
afterAll(() => vi.unstubAllEnvs());

describe("who may use the feed", () => {
  it("is for approved members and admins only", () => {
    denied(() => feed(as(null), {}));
    denied(() => feed(as(PENDING), {}));
    denied(() => post(PENDING, "hi"));
    expect(feed(as(BEA), {}).posts).toEqual([]);
    expect(feed(as(ADMIN), {}).posts).toEqual([]);
  });

  it("refuses anyone else's love, reply or delete before touching the post", () => {
    const p = post(BEA, "Bread is back");
    denied(() => love(as(PENDING), { postId: p, on: true }));
    denied(() => reply(as(null), { postId: p, body: "hi" }));
    denied(() => deletePost(as(PENDING), { id: p }));
    expect(feed(as(BEA), {}).posts[0].loves).toBe(0);
  });
});

describe("posting", () => {
  it("stores a trimmed post with its author's published facts", () => {
    post(BEA, "  Wholesale is open again.  ", { kind: "offer" });
    const [p] = feed(as(CARA), {}).posts;
    expect(p).toMatchObject({ kind: "offer", body: "Wholesale is open again.", canDelete: false });
    expect(p.author).toMatchObject({ name: "Bea", line: "Baker, Little Loaf", neighborhood: "Astoria", slug: expect.stringMatching(/^bea-\d+$/) });
    expect(feed(as(BEA), {}).posts[0].canDelete).toBe(true);
  });

  it("refuses an unknown kind, an empty post and a fifth photo", () => {
    expect(() => post(BEA, "x", { kind: "sale" })).toThrow(/post type/);
    expect(() => post(BEA, "   ")).toThrow(/Write something/);
    const photo = { bytes: TINY.png, alt: "" };
    expect(() => post(BEA, "x", { photos: Array(5).fill(photo) })).toThrow(/Up to 4/);
  });

  it("refuses a post whose second photo isn't an image, and writes none of them", () => {
    expect(() => post(BEA, "x", { photos: [{ bytes: TINY.png, alt: "" }, { bytes: new Uint8Array([1, 2, 3]), alt: "" }] })).toThrow(/JPG, PNG or WebP/);
    expect(db.prepare("select count(*) as n from feed_posts").get()).toEqual({ n: 0 });
  });

  it("serves a post's photos to members and admins only, and deletes them with the post", () => {
    const p = post(BEA, "", { photos: [{ bytes: TINY.png, alt: " Loaves on a shelf " }, { bytes: TINY.webp, alt: "" }] });
    const { photos } = feed(as(CARA), {}).posts[0];
    expect(photos.map((ph) => ph.alt)).toEqual(["Loaves on a shelf", ""]);
    expect(photos[0].url).toBe(`/media/feed/${BEA}/${p}-1.png`);
    expect([CARA, ADMIN, BEA].every((who) => sees(who, photos[0].url))).toBe(true);
    expect(sees(PENDING, photos[0].url) || sees(null, photos[0].url)).toBe(false);
    deletePost(as(BEA), { id: p });
    expect(existsSync(mediaFile("feed", `${BEA}/${p}-1.png`)!)).toBe(false);
    expect(sees(CARA, photos[0].url)).toBe(false);
  });

  it("gives an author's portrait only to readers who may see it", () => {
    writeMedia("avatars", `${CARA}/avatar-1.png`, TINY.png);
    run("update profiles set avatar_path = ? where id = ?", `${CARA}/avatar-1.png`, CARA);
    post(CARA, "Hello");
    // Cara is approved but not listed: members don't see her portrait (nor get a member page link); she and admins do.
    expect(feed(as(BEA), {}).posts[0].author).toMatchObject({ image: undefined, slug: undefined });
    expect(feed(as(CARA), {}).posts[0].author.image).toBe(`/media/avatars/${CARA}/avatar-1.png`);
    expect(feed(as(ADMIN), {}).posts[0].author.image).toBe(`/media/avatars/${CARA}/avatar-1.png`);
  });
});

describe("reading", () => {
  it("pages newest first without skipping or repeating a post that shares a timestamp", () => {
    const ids = Array.from({ length: 25 }, (_, i) => post(BEA, `Post ${i}`));
    ids.forEach((p, i) => at(p, `2026-11-${String(1 + Math.floor(i / 2)).padStart(2, "0")}T12:00:00.000Z`));
    const first = feed(as(CARA), {});
    expect(first.posts).toHaveLength(20);
    const second = feed(as(CARA), { cursor: first.next });
    expect(second.next).toBeNull();
    const seen = [...first.posts, ...second.posts].map((p) => p.id);
    expect(new Set(seen).size).toBe(25);
    expect(seen[0]).toBe(ids[24]);
  });

  it("filters by her own neighborhood, asks and offers, and gatherings", () => {
    post(BEA, "Astoria offer", { kind: "offer" });
    post(CARA, "Sunnyside ask", { kind: "ask" });
    post(CARA, "Sunnyside gathering", { kind: "gathering" });
    const bodies = (who: string, filter: string) => feed(as(who), { filter }).posts.map((p) => p.body).sort();
    expect(bodies(BEA, "hood")).toEqual(["Astoria offer"]);
    expect(bodies(CARA, "hood")).toEqual(["Sunnyside ask", "Sunnyside gathering"]);
    expect(bodies(ADMIN, "hood")).toEqual([]); // no neighborhood of her own
    expect(bodies(BEA, "asks")).toEqual(["Astoria offer", "Sunnyside ask"]);
    expect(bodies(BEA, "gatherings")).toEqual(["Sunnyside gathering"]);
    expect(() => feed(as(BEA), { filter: "Astoria" })).toThrow(/filter/);
    expect(() => feed(as(BEA), { cursor: "nope" })).toThrow(/cursor/);
  });

  it("counts this week's posts and her own tally", () => {
    const old = post(BEA, "Old news");
    at(old, "2020-01-01T00:00:00.000Z");
    const p = post(BEA, "New");
    love(as(CARA), { postId: p, on: true });
    love(as(BEA), { postId: p, on: true }); // her own love isn't one she received
    expect(feed(as(BEA), {})).toMatchObject({ week: 1, mine: { posts: 2, loves: 1 }, neighborhood: "Astoria" });
  });

  it("drops a love from her tally, as from the post, once the lover is no longer approved", () => {
    const p = post(BEA, "Bread");
    love(as(CARA), { postId: p, on: true });
    run("update profiles set status = 'declined' where id = ?", CARA);
    const page = feed(as(BEA), {});
    run("update profiles set status = 'approved' where id = ?", CARA);
    expect([page.posts[0].loves, page.mine.loves]).toEqual([0, 0]);
  });
});

describe("loves and replies", () => {
  it("loves once per member, names the others, and un-loves", () => {
    const p = post(BEA, "Bread");
    expect(love(as(CARA), { postId: p, on: true })).toEqual({ loves: 1, loved: true, lovedBy: [] });
    love(as(CARA), { postId: p, on: true });
    expect(love(as(ADMIN), { postId: p, on: true })).toEqual({ loves: 2, loved: true, lovedBy: ["Cara"] });
    expect(love(as(BEA), { postId: p, on: false })).toMatchObject({ loves: 2, loved: false });
    expect(love(as(CARA), { postId: p, on: false })).toEqual({ loves: 1, loved: false, lovedBy: ["Ada"] });
    expect(() => love(as(CARA), { postId: "missing", on: true })).toThrow(/removed/);
  });

  it("replies in order; the author or an admin deletes a reply, no one else", () => {
    const p = post(BEA, "Who makes bud vases?", { kind: "ask" });
    reply(as(CARA), { postId: p, body: " I do! " });
    const replies = reply(as(BEA), { postId: p, body: "Wonderful" });
    expect(replies.map((r) => [r.body, r.canDelete])).toEqual([["I do!", false], ["Wonderful", true]]);
    expect(() => reply(as(CARA), { postId: p, body: "   " })).toThrow(/Write a reply/);
    denied(() => deleteReply(as(BEA), { id: replies[0].id }));
    expect(deleteReply(as(ADMIN), { id: replies[0].id }).map((r) => r.body)).toEqual(["Wonderful"]);
    expect(deleteReply(as(BEA), { id: replies[1].id })).toEqual([]);
  });

  it("deletes a post with its loves and replies: her own, or any as an admin", () => {
    const p = post(BEA, "Mine");
    love(as(CARA), { postId: p, on: true });
    reply(as(CARA), { postId: p, body: "Nice" });
    denied(() => deletePost(as(CARA), { id: p }));
    deletePost(as(ADMIN), { id: p });
    expect(db.prepare("select (select count(*) from feed_loves) + (select count(*) from feed_replies) as n").get()).toEqual({ n: 0 });
    expect(() => deletePost(as(BEA), { id: p })).toThrow(/removed/);
  });
});

it("reads a page in a fixed number of queries, however many posts, loves and replies it holds", () => {
  writeMedia("avatars", `${CARA}/avatar-1.png`, TINY.png);
  run("update profiles set avatar_path = ? where id = ?", `${CARA}/avatar-1.png`, CARA);
  const busy = (n: number) => {
    for (let i = 0; i < n; i++) {
      const p = post(i % 2 ? BEA : CARA, `Post ${i}`);
      love(as(CARA), { postId: p, on: true });
      if (i % 3 === 0) love(as(ADMIN), { postId: p, on: true });
      reply(as(BEA), { postId: p, body: `Reply ${i}` });
      reply(as(CARA), { postId: p, body: `Again ${i}` });
    }
  };
  const queries = () => {
    const spy = vi.spyOn(db, "prepare");
    try {
      return { page: feed(as(BEA), {}), n: spy.mock.calls.length };
    } finally {
      spy.mockRestore();
    }
  };
  busy(2);
  const few = queries();
  busy(10);
  const many = queries();
  expect(many.page.posts).toHaveLength(12);
  expect(many.n).toBe(few.n);
  // Each post keeps its own loves, lovers and replies.
  for (const p of many.page.posts) {
    const i = Number(p.body.split(" ")[1]);
    expect(p).toMatchObject({ loves: i % 3 === 0 ? 2 : 1, loved: false });
    expect([...p.lovedBy].sort()).toEqual(i % 3 === 0 ? ["Ada", "Cara"] : ["Cara"]); // same-millisecond loves may tie
    expect(p.replies.map((r) => r.body)).toEqual([`Reply ${i}`, `Again ${i}`]);
  }
  run("update profiles set avatar_path = null where id = ?", CARA);
});

it("hides a member's posts, replies and photos once she is no longer approved, and shows them again if she is", () => {
  const p = post(CARA, "", { photos: [{ bytes: TINY.png, alt: "" }] });
  const q = post(BEA, "Hi");
  reply(as(CARA), { postId: q, body: "Hello Bea" });
  const url = feed(as(BEA), {}).posts.find((x) => x.id === p)!.photos[0].url;
  run("update profiles set status = 'declined' where id = ?", CARA);
  const page = feed(as(BEA), {});
  expect(page.posts.map((x) => x.id)).toEqual([q]);
  expect(page.posts[0].replies).toEqual([]);
  expect(sees(BEA, url)).toBe(false);
  expect(() => love(as(BEA), { postId: p, on: true })).toThrow(/removed/);
  run("update profiles set status = 'approved' where id = ?", CARA);
  expect(feed(as(BEA), {}).posts).toHaveLength(2);
});

describe("POST /api/feed", () => {
  const multipart = async (fields: [string, string | Blob][]) => {
    const f = new FormData();
    for (const [k, v] of fields) f.append(k, v);
    const res = new Response(f);
    const body = new Uint8Array(await res.arrayBuffer());
    return new Request("http://club.test/api/feed", {
      method: "POST", body, headers: { "Content-Type": res.headers.get("Content-Type")!, "Content-Length": String(body.byteLength) },
    });
  };

  it("refuses a body of unknown or excessive size, and a non-member, before reading it", async () => {
    const tooBig = new Request("http://club.test/api/feed", { method: "POST", body: "x", headers: { "Content-Length": String(30 * 1024 * 1024) } });
    expect((await feedRequest(as(BEA), tooBig)).status).toBe(413);
    expect((await feedRequest(as(PENDING), await multipart([["kind", "update"], ["body", "hi"]]))).status).toBe(403);
    expect((await feedRequest(as(null), await multipart([["kind", "update"], ["body", "hi"]]))).status).toBe(401);
  });

  it("posts the words and each photo with its description", async () => {
    const res = await feedRequest(as(BEA), await multipart([
      ["kind", "ask"], ["body", "Vases?"], ["photo", new Blob([TINY.jpg])], ["alt", "A small vase"],
    ]));
    expect(res.status).toBe(200);
    const [p] = feed(as(CARA), {}).posts;
    expect(p).toMatchObject({ id: (await res.json()).id, kind: "ask", body: "Vases?", photos: [{ alt: "A small vase" }] });
    expect(p.photos[0].url).toMatch(/-1\.jpg$/);
  });

  it("stops a runaway member after ten posts in ten minutes", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await feedRequest(as(ADMIN), await multipart([["kind", "update"], ["body", `${i}`]]))).status);
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
