// Server-only: profiles, the directory and member images. The access rules are the old RLS policies
// (0001 members-only directory, 0002 public profiles, 0000/0001 self-only profile edits + protect_profile_fields).
import type { MemberProfile } from "@/index";
import type { Ctx } from "@/server/context.server";
import { tx } from "@/server/db";
import { AccessError, isAdmin, isMember, requireSession } from "@/server/guard";
import { checkImage, mediaUrl, removeMedia, writeMedia } from "@/server/media";
import { bad, isObject, str } from "@/server/validate";
import { checkSize, fileBytes, readForm, respond } from "@/server/request";
import { toMemberProfile } from "./map";

export type MembershipStatus = "pending" | "approved" | "declined";
export type Profile = {
  id: string; full_name: string; role_title: string; business: string; neighborhood: string | null; specialty: string;
  bio: string; looking_for: string; website: string; avatar_path: string | null; business_logo_url: string | null;
  directory_visible: boolean; public_profile: boolean; status: MembershipStatus; catalogue_number: number | null;
  member_since: string | null; created_at: string; updated_at: string;
};
export type ProfileData = { profile: Profile; avatarUrl: string | undefined; logoUrl?: string };
type ProfileRow = Omit<Profile, "directory_visible" | "public_profile"> & { directory_visible: number; public_profile: number };

export const toProfile = (row: ProfileRow): Profile =>
  ({ ...row, directory_visible: row.directory_visible === 1, public_profile: row.public_profile === 1 });

const avatar = (path: string | null) => mediaUrl("avatars", path);
const card = (row: ProfileRow, withLogo = false): MemberProfile =>
  toMemberProfile(row, { image: avatar(row.avatar_path), logo: withLogo ? avatar(row.business_logo_url) : undefined });

const LISTED = "status = 'approved' and directory_visible = 1";

/** Approved, listed members, for approved members and admins only (public_directory()); others get an empty list. */
export function directory({ db, actor }: Ctx): MemberProfile[] {
  const me = requireSession(actor);
  if (!isMember(db, me.id) && !isAdmin(db, me.id)) return [];
  const rows = db.prepare(`select * from profiles where ${LISTED} order by catalogue_number`).all() as ProfileRow[];
  return rows.map((row) => card(row, true));
}

/**
 * Opted-in public cards (public_profiles(), §2.10): approved + listed + public, for anyone. No id leaves the
 * server: cards are keyed by catalogue number, and the portrait is /media/public/<catalogue number>/avatar.
 */
export function publicProfiles({ db }: Ctx): MemberProfile[] {
  const rows = db.prepare(`select * from profiles where ${LISTED} and public_profile = 1 order by catalogue_number`).all() as ProfileRow[];
  return rows.map((row) => ({
    ...toMemberProfile(row, { image: row.avatar_path ? `/media/public/${row.catalogue_number}/avatar` : undefined }),
    id: `catalogue-${row.catalogue_number}`,
  }));
}

/** Her own profile with image URLs, or null. */
export function ownProfile({ db, actor }: Ctx): ProfileData | null {
  const me = requireSession(actor);
  const row = db.prepare("select * from profiles where id = ?").get(me.id) as ProfileRow | undefined;
  if (!row) return null;
  return { profile: toProfile(row), avatarUrl: avatar(row.avatar_path), logoUrl: avatar(row.business_logo_url) };
}

const INTROS = 4;

/**
 * Up to four other approved, listed members, same neighborhood first (T15); without a neighborhood, the first four
 * from anywhere. Like the old profiles policies, only approved members and admins see anyone.
 */
export function intros({ db, actor }: Ctx, neighborhood: string | null): MemberProfile[] {
  const me = requireSession(actor);
  if (!isMember(db, me.id) && !isAdmin(db, me.id)) return [];
  const rows = db.prepare(
    `select * from profiles where id <> ? and ${LISTED}
     order by (case when ? is not null and neighborhood = ? then 0 else 1 end), catalogue_number limit ${INTROS}`,
  ).all(me.id, neighborhood, neighborhood) as ProfileRow[];
  return rows.map((row) => card(row));
}

// What a member may change on her own card. status, catalogue_number, member_since (and roles) are admin-only
// (the old protect_profile_fields trigger); image paths change only through uploads.
const TEXT_FIELDS = ["full_name", "role_title", "business", "specialty", "bio", "looking_for", "website"] as const;
const FLAGS = ["directory_visible", "public_profile"] as const;
export type ProfilePatch = Partial<Pick<Profile, (typeof TEXT_FIELDS)[number] | (typeof FLAGS)[number] | "neighborhood">>;

/** Self-only edit of her card. Admin-only or unknown fields are rejected, not silently dropped. */
export function saveProfile({ db, actor }: Ctx, patch: unknown): Profile {
  const me = requireSession(actor);
  if (!isObject(patch)) throw bad("profile");
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if ((TEXT_FIELDS as readonly string[]).includes(key)) values.push(str(value, key, 1000));
    else if ((FLAGS as readonly string[]).includes(key)) {
      if (typeof value !== "boolean") throw bad(key);
      values.push(value ? 1 : 0);
    } else if (key === "neighborhood") values.push(value === null ? null : str(value, key, 100));
    else throw new AccessError(`You can’t change ${key}.`);
    sets.push(`${key} = ?`);
  }
  if (sets.length) db.prepare(`update profiles set ${sets.join(", ")} where id = ?`).run(...values, me.id);
  return toProfile(db.prepare("select * from profiles where id = ?").get(me.id) as ProfileRow);
}

export type ImageKind = "avatar" | "logo";

/**
 * Stores a portrait or business logo in her own folder and points her card at it, then deletes the file it
 * replaced, so each member keeps only her current portrait and logo on disk.
 */
export function uploadImage({ db, actor }: Ctx, kind: ImageKind, bytes: Uint8Array): Profile {
  const me = requireSession(actor);
  const ext = checkImage(bytes);
  const name = `${me.id}/${kind}-${Date.now()}.${ext}`;
  writeMedia("avatars", name, bytes);
  const column = kind === "avatar" ? "avatar_path" : "business_logo_url";
  const { old, row } = tx(db, () => {
    const previous = (db.prepare(`select ${column} as path from profiles where id = ?`).get(me.id) as { path: string | null } | undefined)?.path;
    db.prepare(`update profiles set ${column} = ? where id = ?`).run(name, me.id);
    return { old: previous, row: db.prepare("select * from profiles where id = ?").get(me.id) as ProfileRow };
  });
  // After the commit: a failed update never loses the file her card still shows.
  if (old && old !== name) removeMedia("avatars", old);
  return toProfile(row);
}

/** Clears her logo (what others see) first, then deletes the file; a leftover file is harmless. */
export function removeLogo({ db, actor }: Ctx): Profile {
  const me = requireSession(actor);
  const profile = tx(db, () => {
    const old = (db.prepare("select business_logo_url from profiles where id = ?").get(me.id) as { business_logo_url: string | null } | undefined)
      ?.business_logo_url;
    db.prepare("update profiles set business_logo_url = null where id = ?").run(me.id);
    return { old, row: db.prepare("select * from profiles where id = ?").get(me.id) as ProfileRow };
  });
  if (profile.old) removeMedia("avatars", profile.old);
  return toProfile(profile.row);
}

export const MAX_UPLOAD_REQUEST = 6 * 1024 * 1024;

/** POST /api/images (FormData `kind`, `file`): size and session are checked before the body is read. */
export function uploadImageRequest(c: Ctx, request: Request): Promise<Response> {
  return respond(async () => {
    checkSize(request, MAX_UPLOAD_REQUEST);
    requireSession(c.actor);
    const form = await readForm(request);
    const kind = form.get("kind");
    if (kind !== "avatar" && kind !== "logo") throw bad("upload");
    return uploadImage(c, kind, await fileBytes(form));
  });
}
