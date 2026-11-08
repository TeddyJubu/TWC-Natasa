import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { fake } from "@/test/fake-fns";

vi.mock("@/features/neighborhoods/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));

import { neighborhoodsQuery, NEIGHBORHOOD_SEED } from "./queries";

const run = () => (neighborhoodsQuery.queryFn as (c: unknown) => Promise<unknown>)({});

beforeEach(() => fake.reset());

describe("neighborhoodsQuery", () => {
  it("returns every row from the server, inactive included, in its order", async () => {
    const rows = [
      { slug: "b", name: "B", color: "#000000", logoUrl: null, active: false },
      { slug: "a", name: "A", color: "#ffffff", logoUrl: "/media/neighborhood-logos/a.png", active: true },
    ];
    fake.results = [rows];
    expect(await run()).toEqual(rows);
    expect(fake.calls).toEqual([["neighborhoodsFn"]]);
  });

  it("rethrows a server error", async () => {
    fake.results = [new Error("offline")];
    await expect(run()).rejects.toThrow("offline");
  });
});

describe("neighborhoodsQuery cache", () => {
  it("keeps the seed as data when a real fetch fails", async () => {
    const error = new Error("offline");
    fake.results = [error];
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
    await vi.waitFor(() => expect(fake.calls[0]).toEqual(["neighborhoodsFn"]));
    unsubscribe();
  });
});
