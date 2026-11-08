// Imports a Lovable/Supabase export into an EMPTY database (scripts/import-lovable.ts is the CLI). Relative `.ts`
// imports: the CLI runs under plain Node.
// The export is JSON: `users` (auth.users rows), `identities` (auth.identities rows) and one key per public table,
// each an array of rows with Postgres column names. Files (portraits) are not in it: copy the storage buckets into
// ${DATA_DIR}/uploads/<bucket>/ separately.
import { randomUUID } from "node:crypto";
import { tx, type DB } from "./db.ts";
import { backfillLinkedApplicationStatus } from "./backfill.ts";

type Row = Record<string, unknown>;
export type LovableExport = Partial<Record<
  "users" | "identities" | "profiles" | "user_roles" | "events" | "event_rsvps" | "headshot_bookings" | "neighborhoods" | "applications",
  Row[]
>>;
export type ImportCounts = {
  users: number; credentialAccounts: number; googleAccounts: number; profiles: number; user_roles: number; neighborhoods: number;
  events: number; event_rsvps: number; headshot_bookings: number; applications: number;
};

type Value = string | number | null;
const text = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const flag = (v: unknown): number => (v === true || v === "t" || v === "true" || v === 1 ? 1 : 0);
const json = (v: unknown): Row => (typeof v === "string" ? (JSON.parse(v || "{}") as Row) : ((v as Row | null) ?? {}));

/** A Postgres timestamp (`2026-01-01 09:00:00.123456+00`, ISO, …) as the app's ISO-8601 UTC text. */
function iso(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const date = new Date(String(v).replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
  if (Number.isNaN(date.getTime())) throw new Error(`not a timestamp: ${String(v)}`);
  return date.toISOString();
}

function insert(db: DB, table: string, row: Record<string, Value>): void {
  const columns = Object.keys(row);
  db.prepare(`insert into ${table} (${columns.map((c) => `"${c}"`).join(", ")}) values (${columns.map(() => "?").join(", ")})`)
    .run(...columns.map((c) => row[c]));
}

export function importLovable(db: DB, data: LovableExport): ImportCounts {
  return tx(db, () => {
    const used = db.prepare(`select (select count(*) from "user") + (select count(*) from applications) as n`).get() as { n: number };
    if (used.n > 0) throw new Error("The database is not empty: import only into a fresh DATA_DIR.");
    const rows = (key: keyof LovableExport) => data[key] ?? [];
    const counts: ImportCounts = {
      users: 0, credentialAccounts: 0, googleAccounts: 0, profiles: 0, user_roles: 0, neighborhoods: 0,
      events: 0, event_rsvps: 0, headshot_bookings: 0, applications: 0,
    };

    // Neighborhoods first (profiles and events point at their names); exported events replace the seeded ones.
    if (data.events) db.prepare("delete from events").run();
    for (const n of rows("neighborhoods")) {
      db.prepare(
        `insert into neighborhoods (slug, name, color, logo_path, sort_order, active, created_at) values (?, ?, ?, ?, ?, ?, ?)
         on conflict (slug) do update set name = excluded.name, color = excluded.color, logo_path = excluded.logo_path,
           sort_order = excluded.sort_order, active = excluded.active, created_at = excluded.created_at`,
      ).run(text(n.slug), text(n.name), text(n.color), text(n.logo_path), Number(n.sort_order ?? 0), flag(n.active ?? true), iso(n.created_at) ?? new Date().toISOString());
      counts.neighborhoods++;
    }
    const neighborhoods = new Set((db.prepare("select name from neighborhoods").all() as { name: string }[]).map((n) => n.name));

    // Accounts. The user_created trigger gives each a default profile and the member role; both are replaced below.
    for (const u of rows("users")) {
      const meta = json(u.raw_user_meta_data);
      const created = iso(u.created_at) ?? new Date().toISOString();
      insert(db, `"user"`, {
        id: text(u.id), name: text(meta.full_name ?? meta.name) ?? "", email: String(u.email).toLowerCase(),
        emailVerified: u.email_confirmed_at ? 1 : 0, image: text(meta.avatar_url ?? meta.picture), createdAt: created, updatedAt: iso(u.updated_at) ?? created,
      });
      counts.users++;
      if (typeof u.encrypted_password === "string" && u.encrypted_password.startsWith("$2")) {
        insert(db, "account", { id: randomUUID(), accountId: text(u.id), providerId: "credential", userId: text(u.id), password: u.encrypted_password, createdAt: created, updatedAt: created });
        counts.credentialAccounts++;
      }
    }
    for (const i of rows("identities")) {
      if (i.provider !== "google") continue;
      const sub = text(i.provider_id) ?? text(json(i.identity_data).sub);
      insert(db, "account", {
        id: randomUUID(), accountId: sub, providerId: "google", userId: text(i.user_id),
        createdAt: iso(i.created_at) ?? new Date().toISOString(), updatedAt: iso(i.updated_at ?? i.created_at) ?? new Date().toISOString(),
      });
      counts.googleAccounts++;
    }
    db.prepare("delete from profiles").run();
    db.prepare("delete from user_roles").run();

    for (const p of rows("profiles")) {
      const id = String(p.id);
      const ownFile = (v: unknown) => (typeof v === "string" && v.startsWith(`${id}/`) ? v : null);
      insert(db, "profiles", {
        id, full_name: text(p.full_name) ?? "", role_title: text(p.role_title) ?? "", business: text(p.business) ?? "",
        // Values the new schema can't hold are cleared, not fatal: an unknown neighborhood, a file outside her folder.
        neighborhood: neighborhoods.has(String(p.neighborhood)) ? String(p.neighborhood) : null,
        specialty: text(p.specialty) ?? "", bio: text(p.bio) ?? "", looking_for: text(p.looking_for) ?? "", website: text(p.website) ?? "",
        avatar_path: ownFile(p.avatar_path), business_logo_url: ownFile(p.business_logo_url),
        directory_visible: flag(p.directory_visible), public_profile: flag(p.public_profile), status: text(p.status) ?? "pending",
        catalogue_number: p.catalogue_number === null || p.catalogue_number === undefined ? null : Number(p.catalogue_number),
        member_since: iso(p.member_since), created_at: iso(p.created_at) ?? new Date().toISOString(), updated_at: iso(p.updated_at) ?? new Date().toISOString(),
      });
      counts.profiles++;
    }
    for (const r of rows("user_roles")) {
      insert(db, "user_roles", { user_id: text(r.user_id), role: text(r.role) });
      counts.user_roles++;
    }
    // Accounts without an exported profile or role still get the defaults every account has.
    db.prepare(`insert into profiles (id, full_name) select id, name from "user" where id not in (select id from profiles)`).run();
    db.prepare(`insert into user_roles (user_id, role) select id, 'member' from "user" where id not in (select user_id from user_roles)`).run();

    for (const e of rows("events")) {
      insert(db, "events", {
        id: text(e.id), title: text(e.title), description: text(e.description) ?? "", location: text(e.location),
        neighborhood: text(e.neighborhood), starts_at: iso(e.starts_at), kind: text(e.kind) ?? "gathering",
      });
      counts.events++;
    }
    for (const r of rows("event_rsvps")) {
      insert(db, "event_rsvps", { id: text(r.id), user_id: text(r.user_id), event_id: text(r.event_id), created_at: iso(r.created_at) ?? new Date().toISOString() });
      counts.event_rsvps++;
    }
    for (const b of rows("headshot_bookings")) {
      insert(db, "headshot_bookings", {
        id: text(b.id), user_id: text(b.user_id), preferred_date: text(b.preferred_date), preferred_time: text(b.preferred_time),
        notes: text(b.notes) ?? "", status: text(b.status) ?? "requested", created_at: iso(b.created_at) ?? new Date().toISOString(),
      });
      counts.headshot_bookings++;
    }
    for (const a of rows("applications")) {
      insert(db, "applications", {
        id: text(a.id), user_id: text(a.user_id), email: text(a.email), full_name: text(a.full_name), neighborhood: text(a.neighborhood) ?? "",
        answers: JSON.stringify(json(a.answers)), status: text(a.status) ?? "pending", created_at: iso(a.created_at) ?? new Date().toISOString(),
        reviewed_at: iso(a.reviewed_at), reviewed_by: text(a.reviewed_by),
      });
      counts.applications++;
    }

    // New catalogue numbers continue after the imported ones; stuck pending profiles take their reviewed outcome.
    db.prepare("update catalogue_seq set last = max(last, coalesce((select max(catalogue_number) from profiles), 0))").run();
    backfillLinkedApplicationStatus(db);
    return counts;
  });
}
