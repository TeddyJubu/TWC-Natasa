import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as unknown },
  calls: [] as [string, unknown[]][],
  reject: false,
}));

vi.mock("@/app/supabase", () => ({
  getSupabase: async () => {
    if (h.reject) throw new Error("import failed");
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order"]) {
      chain[m] = (...args: unknown[]) => {
        h.calls.push([m, args]);
        return chain;
      };
    }
    chain.then = (res: (v: unknown) => unknown) => Promise.resolve(h.result).then(res);
    return {
      from: (t: string) => {
        h.calls.push(["from", [t]]);
        return chain;
      },
      storage: {
        from: (bucket: string) => ({
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${bucket}/${path}` } }),
        }),
      },
    };
  },
}));

import { neighborhoodsQuery, NEIGHBORHOOD_SEED } from "./queries";

const run = () => (neighborhoodsQuery.queryFn as (c: unknown) => Promise<unknown>)({});

beforeEach(() => {
  h.calls = [];
  h.reject = false;
  h.result = { data: [], error: null };
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("neighborhoodsQuery", () => {
  it.each(["PGRST205", "42P01"])("falls back to the seed when the table is missing (%s)", async (code) => {
    h.result = { data: null, error: { code, message: "relation does not exist" } };
    expect(await run()).toEqual(NEIGHBORHOOD_SEED);
    expect(console.warn).toHaveBeenCalled();
  });

  it("rethrows errors that are not a missing table", async () => {
    const error = { code: "42501", message: "permission denied" };
    h.result = { data: null, error };
    await expect(run()).rejects.toBe(error);
  });

  it("rejects (no seed fallback) when the lazy import rejects", async () => {
    h.reject = true;
    await expect(run()).rejects.toThrow("import failed");
  });

  it("queries every row, inactive included, ordered by sort_order, and keeps DB order", async () => {
    h.result = {
      data: [
        { slug: "b", name: "B", color: "#000000", logo_path: null, active: false },
        { slug: "a", name: "A", color: "#ffffff", logo_path: "a.png", active: true },
      ],
      error: null,
    };
    const out = await run();
    expect(h.calls.map(([m, args]) => (m === "select" ? ["select"] : [m, args]))).toEqual([
      ["from", ["neighborhoods"]],
      ["select"],
      ["order", ["sort_order"]],
    ]);
    const columns = String(h.calls[1][1][0]).split(",").map((c) => c.trim());
    expect(columns).toEqual(["slug", "name", "color", "logo_path", "active"]);
    expect(out).toEqual([
      { slug: "b", name: "B", color: "#000000", logoUrl: null, active: false },
      { slug: "a", name: "A", color: "#ffffff", logoUrl: "https://cdn.test/neighborhood-logos/a.png", active: true },
    ]);
  });
});

describe("neighborhoodsQuery cache", () => {
  it("keeps the seed as data when a real fetch fails", async () => {
    const error = { code: "42501", message: "permission denied" };
    h.result = { data: null, error };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await qc.prefetchQuery(neighborhoodsQuery);
    const state = qc.getQueryState(neighborhoodsQuery.queryKey);
    expect(state?.status).toBe("error");
    expect(state?.error).toBe(error);
    expect(qc.getQueryData(neighborhoodsQuery.queryKey)).toEqual(NEIGHBORHOOD_SEED);
  });

  it("serves the seed immediately and still fetches on first subscribe", async () => {
    const qc = new QueryClient();
    const observer = new QueryObserver(qc, neighborhoodsQuery);
    expect(observer.getCurrentResult().data).toEqual(NEIGHBORHOOD_SEED);
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() => expect(h.calls[0]).toEqual(["from", ["neighborhoods"]]));
    unsubscribe();
  });
});
