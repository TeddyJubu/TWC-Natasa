// Server-only: the public neighborhood list (anyone reads neighborhoods, 0001).
import type { Ctx } from "@/server/context.server";
import { mediaUrl } from "@/server/media";
import type { Neighborhood } from "./queries";

export type NeighborhoodRow = { slug: string; name: string; color: string; logo_path: string | null; sort_order: number; active: boolean; created_at: string };

export const neighborhoodRows = ({ db }: Ctx): NeighborhoodRow[] =>
  (db.prepare("select * from neighborhoods order by sort_order, name").all() as (Omit<NeighborhoodRow, "active"> & { active: number })[])
    .map((row) => ({ ...row, active: row.active === 1 }));

export const listNeighborhoods = (c: Ctx): Neighborhood[] =>
  neighborhoodRows(c).map((row) => ({
    slug: row.slug, name: row.name, color: row.color, logoUrl: mediaUrl("neighborhood-logos", row.logo_path) ?? null, active: row.active,
  }));
