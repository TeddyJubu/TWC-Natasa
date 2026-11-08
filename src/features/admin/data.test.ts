import { beforeEach, describe, expect, it, vi } from "vitest";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { fake } from "@/test/fake-fns";

vi.mock("@/features/admin/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
const emailApproval = vi.hoisted(() => vi.fn(async (_id: string) => ({ sent: true }) as { sent: true } | { sent: false; reason: string }));
vi.mock("./approval-email", () => ({ emailApproval: (id: string) => emailApproval(id) }));

import {
  adminApplicationsQuery, adminBookingsQuery, adminMembersQuery, adminNeighborhoodsQuery,
} from "./queries";
import {
  createNeighborhood, createNeighborhoodMutation, reviewApplicationMutation, setBookingStatusMutation,
  setMemberStatusMutation, updateNeighborhood, updateNeighborhoodMutation,
} from "./mutations";

const run = (q: { queryFn?: unknown }) => (q.queryFn as (c: unknown) => Promise<unknown>)({});
const denied = new Error("Admins only.");
const keys = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
const form = (i: number) => fake.calls[i][1] as FormData;

beforeEach(() => {
  fake.reset();
  emailApproval.mockClear();
  vi.restoreAllMocks();
});

describe("admin queries", () => {
  it("use the admin keys", () => {
    expect(adminApplicationsQuery.queryKey).toEqual(["admin", "applications"]);
    expect(adminMembersQuery.queryKey).toEqual(["admin", "members"]);
    expect(adminNeighborhoodsQuery.queryKey).toEqual(["admin", "neighborhoods"]);
    expect(adminBookingsQuery.queryKey).toEqual(["admin", "bookings"]);
  });

  it.each([
    ["applications", adminApplicationsQuery, "adminApplicationsFn"],
    ["members", adminMembersQuery, "adminMembersFn"],
    ["neighborhoods", adminNeighborhoodsQuery, "adminNeighborhoodsFn"],
    ["bookings", adminBookingsQuery, "adminBookingsFn"],
  ] as const)("%s: returns the server's rows, and throws its error", async (_name, query, fn) => {
    fake.results = [[{ id: "x" }], denied];
    expect(await run(query)).toEqual([{ id: "x" }]);
    await expect(run(query)).rejects.toBe(denied);
    expect(fake.calls).toEqual([[fn], [fn]]);
  });
});

describe("admin mutations", () => {
  const setup = () => {
    const qc = new QueryClient();
    return { qc, spy: vi.spyOn(qc, "invalidateQueries") };
  };

  it("reviewing an application saves it, emails an approval and refreshes applications, members, directory, public cards and intros", async () => {
    const { qc, spy } = setup();
    fake.results = [null];
    const notice = await new MutationObserver(qc, reviewApplicationMutation(qc)).mutate({ id: "a1", status: "approved" });
    expect(fake.calls).toEqual([["reviewApplicationFn", { id: "a1", status: "approved" }]]);
    expect(emailApproval).toHaveBeenCalledWith("a1");
    expect(notice).toEqual({ sent: true });
    expect(keys(spy)).toEqual([["admin", "applications"], ["admin", "members"], ["directory"], ["public-profiles"], ["intros"]]);
  });

  it("a decline sends no email", async () => {
    const { qc } = setup();
    fake.results = [null];
    expect(await new MutationObserver(qc, reviewApplicationMutation(qc)).mutate({ id: "a1", status: "declined" })).toBeNull();
    expect(emailApproval).not.toHaveBeenCalled();
  });

  it("a member status change saves it and refreshes members, applications, directory, public cards and intros", async () => {
    const { qc, spy } = setup();
    fake.results = [null];
    await new MutationObserver(qc, setMemberStatusMutation(qc)).mutate({ id: "u1", status: "declined" });
    expect(fake.calls).toEqual([["setMemberStatusFn", { id: "u1", status: "declined" }]]);
    expect(keys(spy)).toEqual([["admin", "members"], ["admin", "applications"], ["directory"], ["public-profiles"], ["intros"]]);
  });

  it("approving a member emails her newest application, or says there's none on file", async () => {
    const { qc } = setup();
    fake.results = ["app-9", null];
    expect(await new MutationObserver(qc, setMemberStatusMutation(qc)).mutate({ id: "u1", status: "approved" })).toEqual({ sent: true });
    expect(emailApproval).toHaveBeenCalledWith("app-9");
    expect(await new MutationObserver(qc, setMemberStatusMutation(qc)).mutate({ id: "u2", status: "approved" }))
      .toEqual({ sent: false, reason: "no application on file" });
  });

  it("a booking status change saves it and refreshes admin bookings", async () => {
    const { qc, spy } = setup();
    fake.results = [null];
    await new MutationObserver(qc, setBookingStatusMutation(qc)).mutate({ id: "b1", status: "confirmed" });
    expect(fake.calls).toEqual([["setBookingStatusFn", { id: "b1", status: "confirmed" }]]);
    expect(keys(spy)).toEqual([["admin", "bookings"]]);
  });

  it("rejects with the server's error and invalidates nothing", async () => {
    const { qc, spy } = setup();
    fake.results = [denied];
    await expect(new MutationObserver(qc, reviewApplicationMutation(qc)).mutate({ id: "a1", status: "approved" })).rejects.toBe(denied);
    expect(spy).not.toHaveBeenCalled();
  });

  // Listed literally on purpose: a rename cascades to profiles and events, so every cache showing one refreshes.
  const hoodKeys = [
    ["neighborhoods"], ["admin", "neighborhoods"], ["admin", "members"], ["directory"], ["public-profiles"], ["intros"], ["profile"], ["events"],
  ];

  it("creating a neighborhood saves the row first, then uploads the logo for that slug", async () => {
    const { qc, spy } = setup();
    const logo = new File(["x"], "Logo.PNG", { type: "image/png" });
    fake.results = [null, "woodside.png"];
    await new MutationObserver(qc, createNeighborhoodMutation(qc)).mutate({
      name: " Woodside ", slug: "woodside", color: "#123456", sort_order: 8, logo,
    });
    expect(fake.calls[0]).toEqual(["createNeighborhoodFn", { name: "Woodside", slug: "woodside", color: "#123456", sort_order: 8 }]);
    expect(fake.calls[1][0]).toBe("saveNeighborhoodLogoFn");
    expect([form(1).get("slug"), (form(1).get("file") as File).name]).toEqual(["woodside", "Logo.PNG"]);
    expect(keys(spy)).toEqual(hoodKeys);
  });

  it("creating without a logo only saves the row", async () => {
    fake.results = [null];
    await createNeighborhood({ name: "Woodside", slug: "woodside", color: "#123456", sort_order: 0 });
    expect(fake.calls).toEqual([["createNeighborhoodFn", { name: "Woodside", slug: "woodside", color: "#123456", sort_order: 0 }]]);
  });

  it("a failed save (e.g. a duplicate slug) never uploads the logo", async () => {
    const duplicate = new Error("That already exists.");
    fake.results = [duplicate];
    const logo = new File(["x"], "l.webp", { type: "image/webp" });
    await expect(createNeighborhood({ name: "Woodside", slug: "woodside", color: "#123456", sort_order: 0, logo })).rejects.toBe(duplicate);
    expect(fake.calls.map((c) => c[0])).toEqual(["createNeighborhoodFn"]);
  });

  it("keeps the new row and says so when the logo upload fails, still refreshing the lists", async () => {
    const { qc, spy } = setup();
    fake.results = [null, new Error("disk full")];
    const logo = new File(["x"], "l.webp", { type: "image/webp" });
    await expect(
      new MutationObserver(qc, createNeighborhoodMutation(qc)).mutate({ name: "Woodside", slug: "woodside", color: "#123456", sort_order: 0, logo }),
    ).rejects.toThrow("Neighborhood added, but the logo didn't upload: disk full");
    expect(keys(spy)).toEqual(hoodKeys);
  });

  it.each([
    ["a bad slug", { slug: "Wood Side" }, /slug/i],
    ["a bad color", { color: "blue" }, /color/i],
    ["a JPG logo", { logo: new File(["x"], "l.jpg", { type: "image/jpeg" }) }, /PNG or WebP/],
    ["an oversized logo", { logo: new File([new Uint8Array(2 * 1024 * 1024 + 1)], "l.png", { type: "image/png" }) }, /2 MB/],
  ])("rejects %s before any network call", async (_label, over, message) => {
    await expect(createNeighborhood({ name: "Woodside", slug: "woodside", color: "#123456", sort_order: 0, ...over })).rejects.toThrow(message);
    expect(fake.calls).toEqual([]);
  });

  const edit = { slug: "astoria", name: "Astoria North", color: "#ff9a1f", active: false, sort_order: 2 };

  it("updating saves the row fields first (the slug only as the key), then the logo, and refreshes everything that shows it", async () => {
    const { qc, spy } = setup();
    const logo = new File(["x"], "l.png", { type: "image/png" });
    fake.results = [null, "astoria.png"];
    const out = await new MutationObserver(qc, updateNeighborhoodMutation(qc)).mutate({ ...edit, previousLogoPath: "astoria.png", logo });
    expect(fake.calls[0]).toEqual(["updateNeighborhoodFn", edit]);
    expect([fake.calls[1][0], form(1).get("slug")]).toEqual(["saveNeighborhoodLogoFn", "astoria"]);
    expect(out).toEqual({});
    expect(keys(spy)).toEqual(hoodKeys);
  });

  it("a failed row update never uploads the logo", async () => {
    fake.results = [denied];
    const logo = new File(["x"], "l.webp", { type: "image/webp" });
    await expect(updateNeighborhood({ ...edit, previousLogoPath: null, logo })).rejects.toBe(denied);
    expect(fake.calls.map((c) => c[0])).toEqual(["updateNeighborhoodFn"]);
  });

  it("a failed logo upload after the fields saved says the changes were kept", async () => {
    const { qc, spy } = setup();
    const logo = new File(["x"], "l.webp", { type: "image/webp" });
    fake.results = [null, new Error("disk full")];
    await expect(
      new MutationObserver(qc, updateNeighborhoodMutation(qc)).mutate({ ...edit, previousLogoPath: null, logo }),
    ).rejects.toThrow("Changes saved, but the logo didn't upload: disk full");
    expect(keys(spy)).toEqual(hoodKeys);
  });

  it("updating without a logo only saves the row fields", async () => {
    fake.results = [null];
    expect(await updateNeighborhood({ ...edit, previousLogoPath: "astoria.png" })).toEqual({});
    expect(fake.calls).toEqual([["updateNeighborhoodFn", edit]]);
  });

  it("rejects an invalid update before any network call", async () => {
    await expect(updateNeighborhood({ ...edit, color: "#ff9a1", previousLogoPath: null })).rejects.toThrow(/color/i);
    const logo = new File(["x"], "l.gif", { type: "image/gif" });
    await expect(updateNeighborhood({ ...edit, previousLogoPath: null, logo })).rejects.toThrow(/PNG or WebP/);
    expect(fake.calls).toEqual([]);
  });
});
