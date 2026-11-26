// The club's real members and leads as the design canvas shows them. Member data, so none of it is in this
// (public) repository: the list and the photos live on the server in `${DATA_DIR}/roster/` (roster.json + the photo
// files it names; README "Roster"), never under public/ or src/, so nothing ships in the open /assets bundle.
// Who sees it (user decision, 2026-11-26): anyone past the PIN while the whole site is a private preview behind
// SITE_PIN, and approved members and admins always. After launch a visitor gets an empty roster and a 404 photo.
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Ctx } from "@/server/context.server";
import { dataDir, type DB } from "@/server/db";
import { isAdmin, isMember, type Actor } from "@/server/guard";
import { notFound, notModified } from "@/server/media";

export type Constellation = "NB" | "WQ" | "SB" | "UP" | "DT";
export type RosterMember = {
  name: string;
  /** The neighborhood, as named on the constellation chart. */
  hood: string;
  constellation: Constellation;
  /** `/media/roster/<file>`, served only to viewers who may see the roster. */
  photo: string;
  role?: string;
  business?: string;
  founder?: boolean;
  line?: string;
};
export type Roster = { members: RosterMember[]; /** Who leads each constellation, by name. */ leads: Partial<Record<Constellation, string>> };

type Stored = { leads?: Roster["leads"]; members?: (Omit<RosterMember, "photo"> & { file: string })[] };
const EMPTY: Roster = { members: [], leads: {} };
const FILE = /^[a-z0-9-]+\.webp$/;
const dir = () => join(dataDir(), "roster");

function stored(): Stored {
  try {
    return JSON.parse(readFileSync(join(dir(), "roster.json"), "utf8")) as Stored;
  } catch {
    return {}; // no roster on this server yet: the pages draw open seats
  }
}

export function readRoster(): Roster {
  const s = stored();
  const members = (s.members ?? []).filter((m) => FILE.test(m.file)).map(({ file, ...m }) => ({ ...m, photo: `/media/roster/${file}` }));
  return { members, leads: s.leads ?? {} };
}

/** True while the site is behind its PIN, or for an approved member or admin. */
export function canSeeRoster(db: DB, actor: Actor, env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.SITE_PIN) || isMember(db, actor?.id) || isAdmin(db, actor?.id);
}

export function roster({ db, actor }: Ctx): Roster {
  return canSeeRoster(db, actor) ? readRoster() : EMPTY;
}

/** `/media/roster/<file>`: a photo roster.json names, to a viewer who may see the roster; anything else a 404. */
export function serveRosterPhoto(db: DB, actor: Actor, pathname: string, headers?: Headers): Response {
  const name = pathname.slice("/media/roster/".length);
  if (!FILE.test(name) || !canSeeRoster(db, actor) || !(stored().members ?? []).some((m) => m.file === name)) return notFound();
  const file = join(dir(), name);
  let stat;
  try { stat = statSync(file); } catch { return notFound(); }
  const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const base = { "Cache-Control": "private, max-age=3600", ETag: etag, "Last-Modified": stat.mtime.toUTCString() };
  if (headers && notModified(headers, etag, stat.mtimeMs)) return new Response(null, { status: 304, headers: base });
  return new Response(readFileSync(file), { headers: { ...base, "Content-Type": "image/webp" } });
}
