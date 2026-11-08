import { queryOptions, useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/app/supabase";

/** Inactive rows stay in the list so cards that still use one keep its color and logo; pickers hide them (pickerNames). */
export type Neighborhood = { slug: string; name: string; color: string; logoUrl: string | null; active: boolean };

// Mirrors the seed in db/migrations/0001_init.sql (src/server/db.test.ts keeps them in sync).
export const NEIGHBORHOOD_SEED: Neighborhood[] = [
  { slug: "long-island-city", name: "Long Island City", color: "#2f9dff", logoUrl: null, active: true },
  { slug: "astoria", name: "Astoria", color: "#ff9a1f", logoUrl: null, active: true },
  { slug: "sunnyside", name: "Sunnyside", color: "#9b64ff", logoUrl: null, active: true },
  { slug: "jackson-heights", name: "Jackson Heights", color: "#ff4d9e", logoUrl: null, active: true },
  { slug: "elmhurst", name: "Elmhurst", color: "#12d9bd", logoUrl: null, active: true },
  { slug: "forest-hills", name: "Forest Hills", color: "#5fd35f", logoUrl: null, active: true },
  { slug: "rego-park", name: "Rego Park", color: "#ff4438", logoUrl: null, active: true },
];

export const neighborhoodsQuery = queryOptions({
  queryKey: ["neighborhoods"],
  staleTime: 60 * 60 * 1000,
  // Real (stale) data, not a placeholder: a failed fetch keeps the seed, and updatedAt 0 still fetches on mount.
  initialData: NEIGHBORHOOD_SEED,
  initialDataUpdatedAt: 0,
  queryFn: async (): Promise<Neighborhood[]> => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("neighborhoods")
      .select("slug, name, color, logo_path, active")
      .order("sort_order");
    if (error) {
      // Intentional while migration 0001 is unapplied: only a missing table serves the bundled seed.
      if (error.code === "PGRST205" || error.code === "42P01") {
        console.warn("neighborhoods: table missing, falling back to bundled seed", error);
        return NEIGHBORHOOD_SEED;
      }
      throw error;
    }
    return data.map((row) => ({
      slug: row.slug,
      name: row.name,
      color: row.color,
      logoUrl: row.logo_path
        ? supabase.storage.from("neighborhood-logos").getPublicUrl(row.logo_path).data.publicUrl
        : null,
      active: row.active,
    }));
  },
});

export const useNeighborhoods = () => useQuery(neighborhoodsQuery);
