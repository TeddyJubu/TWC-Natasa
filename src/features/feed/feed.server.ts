// Server-only: the members' newsfeed (/feed; migration 0013, DESIGN.md "Newsfeed"). Approved members and admins read,
// post, love and reply; a member deletes her own posts and replies, an admin anyone's. Someone no longer approved (and
// not an admin) drops out of the feed with her posts, loves and replies, and her photos stop being served
// (canSeeFeedFolder). Bodies and photo descriptions are plain text, never HTML.
import { randomUUID } from "node:crypto";
import type { Ctx } from "@/server/context.server";
import type { DB } from "@/server/db";
import { AccessError, isAdmin, requireMember } from "@/server/guard";
import { canSeeAvatarFolder, checkImage, MAX_FEED_IMAGE_EDGE, MAX_UPLOAD_BYTES, mediaUrl, removeMedia, writeMedia } from "@/server/media";
import { checkSize, HttpError, rateLimit, readForm, respond } from "@/server/request";
import { bad, isObject, oneOf, str } from "@/server/validate";
import { memberSlug } from "@/features/members/map";
import { FEED_FILTERS, FEED_KINDS, MAX_ALT, MAX_PHOTOS, MAX_POST, MAX_REPLY, type FeedKind } from "./kinds";

export type { FeedFilter, FeedKind } from "./kinds";
const PAGE = 20;

/** Who wrote it: only what the directory would show. `image` only when the reader may see her portrait; `slug` only when she has a member page. */
export type FeedAuthor = { name: string; line: string; neighborhood: string; image?: string; slug?: string };
export type FeedPhoto = { url: string; alt: string };
export type FeedReply = { id: string; author: FeedAuthor; body: string; createdAt: string; canDelete: boolean };
/** `lovedBy`: up to two other members who loved it, most recent first. */
export type PostLoves = { loves: number; loved: boolean; lovedBy: string[] };
export type FeedPost = PostLoves & {
  id: string; kind: FeedKind; body: string; createdAt: string; author: FeedAuthor; photos: FeedPhoto[]; replies: FeedReply[]; canDelete: boolean;
};
/** `next` is the cursor for older posts (null at the end). `week`: posts in the last seven days; `mine`: her own tally. */
export type FeedPage = { posts: FeedPost[]; next: string | null; neighborhood: string | null; week: number; mine: { posts: number; loves: number } };

type AuthorRow = {
  author_id: string; full_name: string; role_title: string; business: string; neighborhood: string | null; avatar_path: string | null;
  directory_visible: number; status: string; catalogue_number: number | null;
};
type PostRow = AuthorRow & { id: string; kind: FeedKind; body: string; photos: string; created_at: string };
type ReplyRow = AuthorRow & { id: string; body: string; created_at: string };

const AUTHOR = "a.full_name, a.role_title, a.business, a.neighborhood, a.avatar_path, a.directory_visible, a.status, a.catalogue_number";
/** The author (alias `a`) is still in: approved, or an admin. */
const ACTIVE = "(a.status = 'approved' or exists (select 1 from user_roles r where r.user_id = a.id and r.role = 'admin'))";
const GONE = () => new AccessError("That post has been removed.", 404);

/** Whether the reader may see an author's portrait, asked once per author for one request. */
type Avatars = (authorId: string) => boolean;
function avatarRule(c: Ctx): Avatars {
  const seen = new Map<string, boolean>();
  return (id) => {
    if (!seen.has(id)) seen.set(id, canSeeAvatarFolder(c.db, c.actor, id));
    return seen.get(id)!;
  };
}

function author(row: AuthorRow, avatars: Avatars): FeedAuthor {
  const listed = row.status === "approved" && row.directory_visible === 1 && row.catalogue_number !== null;
  return {
    name: row.full_name || "A member",
    line: [row.role_title, row.business].filter(Boolean).join(", "),
    neighborhood: row.neighborhood ?? "",
    // The avatar rule itself, so the feed never links a portrait the reader would get a 404 for.
    image: row.avatar_path && avatars(row.author_id) ? mediaUrl("avatars", row.avatar_path) : undefined,
    slug: listed ? memberSlug({ name: row.full_name, catalogueNumber: row.catalogue_number! }) : undefined,
  };
}

const marks = (ids: string[]) => ids.map(() => "?").join(", ");

/** Each post's loves as she sees them, two queries for any number of posts. */
function lovesOf(db: DB, me: string, postIds: string[]): Map<string, PostLoves> {
  const out = new Map(postIds.map((id): [string, PostLoves] => [id, { loves: 0, loved: false, lovedBy: [] }]));
  if (postIds.length === 0) return out;
  const counts = db.prepare(
    `select l.post_id, count(*) as n, coalesce(max(l.member_id = ?), 0) as mine from feed_loves l join profiles a on a.id = l.member_id
     where l.post_id in (${marks(postIds)}) and ${ACTIVE} group by l.post_id`,
  ).all(me, ...postIds) as { post_id: string; n: number; mine: number }[];
  for (const r of counts) Object.assign(out.get(r.post_id)!, { loves: r.n, loved: r.mine === 1 });
  // Up to two other lovers per post, most recent first.
  const names = db.prepare(
    `select post_id, name from (
       select l.post_id, a.full_name as name, row_number() over (partition by l.post_id order by l.created_at desc) as k
       from feed_loves l join profiles a on a.id = l.member_id
       where l.post_id in (${marks(postIds)}) and l.member_id <> ? and a.full_name <> '' and ${ACTIVE}
     ) where k <= 2 order by post_id, k`,
  ).all(...postIds, me) as { post_id: string; name: string }[];
  for (const r of names) out.get(r.post_id)!.lovedBy.push(r.name);
  return out;
}

/** Each post's replies in order, one query for any number of posts. */
function repliesOf(c: Ctx, me: string, admin: boolean, postIds: string[], avatars = avatarRule(c)): Map<string, FeedReply[]> {
  const out = new Map(postIds.map((id): [string, FeedReply[]] => [id, []]));
  if (postIds.length === 0) return out;
  const rows = c.db.prepare(
    `select r.post_id, r.id, r.body, r.created_at, r.author_id, ${AUTHOR} from feed_replies r join profiles a on a.id = r.author_id
     where r.post_id in (${marks(postIds)}) and ${ACTIVE} order by r.post_id, r.created_at, r.rowid`,
  ).all(...postIds) as (ReplyRow & { post_id: string })[];
  for (const r of rows) {
    out.get(r.post_id)!.push({ id: r.id, author: author(r, avatars), body: r.body, createdAt: r.created_at, canDelete: admin || r.author_id === me });
  }
  return out;
}

/** A post that exists and whose author is still in, or a 404. */
function livePost(db: DB, id: unknown): string {
  const postId = str(id, "post", 64);
  if (!db.prepare(`select 1 from feed_posts p join profiles a on a.id = p.author_id where p.id = ? and ${ACTIVE}`).get(postId)) throw GONE();
  return postId;
}

/** "<created_at>|<id>": newest first, ties broken by id, so a page boundary never skips or repeats a post. */
function parseCursor(v: unknown): [string, string] {
  const [at, id, extra] = str(v, "cursor", 100).split("|");
  if (extra !== undefined || !at || !id) throw bad("cursor");
  return [at, id];
}

/** One page of the feed, newest first, with each post's loves and replies. */
export function feed(c: Ctx, input: unknown): FeedPage {
  const me = requireMember(c.db, c.actor);
  const { db } = c;
  const options = isObject(input) ? input : {};
  const filter = oneOf(options.filter ?? "all", FEED_FILTERS, "filter");
  const cursor = options.cursor == null ? null : parseCursor(options.cursor);
  const admin = isAdmin(db, me.id);
  const hood = (db.prepare("select neighborhood from profiles where id = ?").get(me.id) as { neighborhood: string | null } | undefined)?.neighborhood ?? null;

  const where = [ACTIVE];
  const args: (string | number)[] = [];
  if (cursor) { where.push("(p.created_at, p.id) < (?, ?)"); args.push(...cursor); }
  if (filter === "hood") { where.push(hood ? "a.neighborhood = ?" : "0"); if (hood) args.push(hood); }
  if (filter === "asks") where.push("p.kind in ('ask', 'offer')");
  if (filter === "gatherings") where.push("p.kind = 'gathering'");
  const rows = db.prepare(
    `select p.id, p.kind, p.body, p.photos, p.created_at, p.author_id, ${AUTHOR} from feed_posts p join profiles a on a.id = p.author_id
     where ${where.join(" and ")} order by p.created_at desc, p.id desc limit ${PAGE + 1}`,
  ).all(...args) as PostRow[];
  const page = rows.slice(0, PAGE);
  const last = page.at(-1);

  // A fixed number of queries per page, however many posts: loves and replies by post id, each author's portrait rule once.
  const ids = page.map((r) => r.id);
  const avatars = avatarRule(c);
  const loves = lovesOf(db, me.id, ids);
  const replies = repliesOf(c, me.id, admin, ids, avatars);
  const posts = page.map((r): FeedPost => ({
    id: r.id, kind: r.kind, body: r.body, createdAt: r.created_at, author: author(r, avatars),
    photos: (JSON.parse(r.photos) as { name: string; alt: string }[]).map((p) => ({ url: mediaUrl("feed", p.name)!, alt: p.alt })),
    ...loves.get(r.id)!,
    replies: replies.get(r.id)!,
    canDelete: admin || r.author_id === me.id,
  }));

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const count = (sql: string, ...a: string[]) => (db.prepare(sql).get(...a) as { n: number }).n;
  return {
    posts,
    next: rows.length > PAGE && last ? `${last.created_at}|${last.id}` : null,
    neighborhood: hood,
    week: count(`select count(*) as n from feed_posts p join profiles a on a.id = p.author_id where ${ACTIVE} and p.created_at >= ?`, weekAgo),
    mine: {
      posts: count("select count(*) as n from feed_posts where author_id = ?", me.id),
      // Only lovers still in, like each post's own count (lovesOf).
      loves: count(
        `select count(*) as n from feed_loves l join feed_posts p on p.id = l.post_id join profiles a on a.id = l.member_id
         where p.author_id = ? and l.member_id <> ? and ${ACTIVE}`, me.id, me.id),
    },
  };
}

export type NewPost = { kind: unknown; body: unknown; photos: { bytes: Uint8Array; alt: unknown }[] };

/**
 * Posts as her. Every photo is checked before any is written; if a write or the insert fails, the files already
 * written are removed, so a failed post leaves nothing behind.
 */
export function createPost(c: Ctx, input: NewPost): { id: string } {
  const me = requireMember(c.db, c.actor);
  const kind = oneOf(input.kind, FEED_KINDS, "post type");
  const body = str(input.body ?? "", "post", MAX_POST).trim();
  if (input.photos.length > MAX_PHOTOS) throw new AccessError(`Up to ${MAX_PHOTOS} photos a post.`, 400);
  if (!body && input.photos.length === 0) throw new AccessError("Write something or add a photo.", 400);
  const id = randomUUID();
  const photos = input.photos.map((p, i) => ({
    name: `${me.id}/${id}-${i + 1}.${checkImage(p.bytes, MAX_FEED_IMAGE_EDGE)}`,
    alt: str(p.alt ?? "", "photo description", MAX_ALT).trim(),
  }));
  try {
    photos.forEach((p, i) => writeMedia("feed", p.name, input.photos[i].bytes));
    c.db.prepare("insert into feed_posts (id, author_id, kind, body, photos) values (?, ?, ?, ?, ?)").run(id, me.id, kind, body, JSON.stringify(photos));
  } catch (error) {
    for (const p of photos) removeMedia("feed", p.name);
    throw error;
  }
  return { id };
}

/** Loves (`on`) or un-loves a post; returns its loves as she now sees them. */
export function love(c: Ctx, input: unknown): PostLoves {
  const me = requireMember(c.db, c.actor);
  if (!isObject(input) || typeof input.on !== "boolean") throw bad("love");
  const postId = livePost(c.db, input.postId);
  if (input.on) c.db.prepare("insert into feed_loves (post_id, member_id) values (?, ?) on conflict do nothing").run(postId, me.id);
  else c.db.prepare("delete from feed_loves where post_id = ? and member_id = ?").run(postId, me.id);
  return lovesOf(c.db, me.id, [postId]).get(postId)!;
}

/** Replies as her; returns the post's replies. */
export function reply(c: Ctx, input: unknown): FeedReply[] {
  const me = requireMember(c.db, c.actor);
  if (!isObject(input)) throw bad("reply");
  const postId = livePost(c.db, input.postId);
  const body = str(input.body, "reply", MAX_REPLY).trim();
  if (!body) throw new AccessError("Write a reply first.", 400);
  c.db.prepare("insert into feed_replies (id, post_id, author_id, body) values (?, ?, ?, ?)").run(randomUUID(), postId, me.id, body);
  return repliesOf(c, me.id, isAdmin(c.db, me.id), [postId]).get(postId)!;
}

/** Her own post, or any post for an admin; its loves, replies and photos go with it. */
export function deletePost(c: Ctx, input: unknown): void {
  const me = requireMember(c.db, c.actor);
  const id = str(isObject(input) ? input.id : undefined, "post", 64);
  const row = c.db.prepare("select author_id, photos from feed_posts where id = ?").get(id) as { author_id: string; photos: string } | undefined;
  if (!row) throw GONE();
  if (row.author_id !== me.id && !isAdmin(c.db, me.id)) throw new AccessError("You can only delete your own posts.");
  c.db.prepare("delete from feed_posts where id = ?").run(id);
  // After the delete: a failed delete never loses a photo the post still shows.
  for (const p of JSON.parse(row.photos) as { name: string }[]) removeMedia("feed", p.name);
}

/** Her own reply, or any reply for an admin; returns the post's remaining replies. */
export function deleteReply(c: Ctx, input: unknown): FeedReply[] {
  const me = requireMember(c.db, c.actor);
  const id = str(isObject(input) ? input.id : undefined, "reply", 64);
  const row = c.db.prepare("select author_id, post_id from feed_replies where id = ?").get(id) as { author_id: string; post_id: string } | undefined;
  if (!row) throw new AccessError("That reply has been removed.", 404);
  const admin = isAdmin(c.db, me.id);
  if (row.author_id !== me.id && !admin) throw new AccessError("You can only delete your own replies.");
  c.db.prepare("delete from feed_replies where id = ?").run(id);
  return repliesOf(c, me.id, admin, [row.post_id]).get(row.post_id)!;
}

/** Four full-size photos plus the words and the multipart overhead. */
export const MAX_FEED_REQUEST = MAX_PHOTOS * MAX_UPLOAD_BYTES + 64 * 1024;
// ponytail: 10 posts per member per 10 minutes, in memory (see rateLimit); members are vetted, this only stops a runaway.
const postLimit = rateLimit(10, 10 * 60 * 1000);

/**
 * POST /api/feed (FormData `kind`, `body`, then `photo` + `alt` pairs): size, membership and the per-member limit are
 * checked before the body is read.
 */
export function feedRequest(c: Ctx, request: Request): Promise<Response> {
  return respond(async () => {
    checkSize(request, MAX_FEED_REQUEST);
    const me = requireMember(c.db, c.actor);
    if (!postLimit(me.id)) throw new HttpError("That’s a lot of posts at once. Please wait a few minutes.", 429);
    const form = await readForm(request);
    const files = form.getAll("photo");
    const alts = form.getAll("alt");
    const photos = await Promise.all(files.map(async (f, i) => {
      if (typeof f === "string") throw bad("upload");
      return { bytes: new Uint8Array(await f.arrayBuffer()), alt: alts[i] ?? "" };
    }));
    return createPost(c, { kind: form.get("kind"), body: form.get("body") ?? "", photos });
  });
}
