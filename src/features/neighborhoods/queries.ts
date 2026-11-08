import { queryOptions, useQuery } from "@tanstack/react-query";
import { neighborhoodsFn } from "./fns";

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
  queryFn: (): Promise<Neighborhood[]> => neighborhoodsFn(),
});

export const useNeighborhoods = () => useQuery(neighborhoodsQuery);
