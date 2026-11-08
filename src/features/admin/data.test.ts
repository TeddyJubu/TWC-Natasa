import { beforeEach, describe, expect, it, vi } from "vitest";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { fake } from "@/test/fake-supabase";

vi.mock("@/app/supabase", async () => (await import("@/test/fake-supabase")).fakeSupabaseModule);

import {
  adminApplicationsQuery, adminBookingsQuery, adminMembersQuery, adminNeighborhoodsQuery,
} from "./queries";
import {
  createNeighborhood, createNeighborhoodMutation, reviewApplicationMutation, setBookingStatusMutation,
  setMemberStatusMutation, updateNeighborhood, updateNeighborhoodMutation,
} from "./mutations";

const run = (q: { queryFn?: unknown }) => (q.queryFn as (c: unknown) => Promise<unknown>)({});
const dbError = { code: "42501", message: "permission denied" };
const ok = { data: null, error: null };
const keys = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);

beforeEach(() => {
  fake.reset();
  vi.restoreAllMocks();
});

describe("admin queries", () => {
  it("use the admin keys", () => {
    expect(adminApplicationsQuery.queryKey).toEqual(["admin", "applications"]);
    expect(adminMembersQuery.queryKey).toEqual(["admin", "members"]);
    expect(adminNeighborhoodsQuery.queryKey).toEqual(["admin", "neighborhoods"]);
    expect(adminBookingsQuery.queryKey).toEqual(["admin", "bookings"]);
  });

  it("applications: every row, pending first then newest", async () => {
    fake.results = [{
      data: [
        { id: "a", status: "approved", created_at: "2026-03-01T00:00:00Z" },
        { id: "b", status: "pending", created_at: "2026-01-01T00:00:00Z" },
      ],
      error: null,
    }];
    const out = (await run(adminApplicationsQuery)) as { id: string }[];
    expect(out.map((a) => a.id)).toEqual(["b", "a"]);
    expect(fake.calls).toEqual([["from", "applications"], ["select", "*"]]);
  });

  it("members: every profile, joined client-side with applicant emails", async () => {
    fake.results = [
      { data: [{ id: "u1", full_name: "Rosa" }, { id: "u2", full_name: "Lena" }], error: null },
      { data: [{ user_id: "u2", email: "lena@x.test" }], error: null },
    ];
    expect(await run(adminMembersQuery)).toEqual([
      { id: "u2", full_name: "Lena", email: "lena@x.test" },
      { id: "u1", full_name: "Rosa", email: null },
    ]);
    expect(fake.calls).toEqual([["from", "profiles"], ["select", "*"], ["from", "applications"], ["select", "user_id, email"]]);
  });

  it("neighborhoods: all rows including inactive, by sort order, with versioned public logo urls", async () => {
    vi.spyOn(Date, "now").mockReturnValue(42);
    fake.results = [{
      data: [
        { slug: "astoria", name: "Astoria", color: "#ff9a1f", logo_path: null, active: true, sort_order: 1 },
        { slug: "woodside", name: "Woodside", color: "#123456", logo_path: "woodside.png", active: false, sort_order: 8 },
      ],
      error: null,
    }];
    const out = (await run(adminNeighborhoodsQuery)) as { logoUrl: string | null }[];
    expect(fake.calls).toEqual([["from", "neighborhoods"], ["select", "*"], ["order", "sort_order"]]);
    // A replaced same-name logo gets a new URL on every refetch, so the browser doesn't reuse the old image.
    expect(out.map((n) => n.logoUrl)).toEqual([null, "https://cdn.test/neighborhood-logos/woodside.png?v=42"]);
  });

  it("bookings: every booking", async () => {
    fake.results = [{ data: [{ id: "b1" }], error: null }];
    expect(await run(adminBookingsQuery)).toEqual([{ id: "b1" }]);
    expect(fake.calls.slice(0, 2)).toEqual([["from", "headshot_bookings"], ["select", "*"]]);
  });

  it.each([
    ["applications", adminApplicationsQuery, 1],
    ["members", adminMembersQuery, 2],
    ["neighborhoods", adminNeighborhoodsQuery, 1],
    ["bookings", adminBookingsQuery, 1],
  ] as const)("%s: throws the query error", async (_name, query, reads) => {
    fake.results = Array.from({ length: reads }, (_, i) => (i === reads - 1 ? { data: null, error: dbError } : { data: [], error: null }));
    await expect(run(query)).rejects.toBe(dbError);
  });
});

describe("admin mutations", () => {
  const setup = () => {
    const qc = new QueryClient();
    return { qc, spy: vi.spyOn(qc, "invalidateQueries") };
  };

  it("reviewing an application updates its status and refreshes applications, members, directory, public cards and intros", async () => {
    const { qc, spy } = setup();
    fake.results = [ok, { data: { session: null }, error: null }];
    const notice = await new MutationObserver(qc, reviewApplicationMutation(qc)).mutate({ id: "a1", status: "approved" });
    // Then the welcome email, as the signed-in admin (no session here, so it isn't sent).
    expect(fake.calls).toEqual([["from", "applications"], ["update", { status: "approved" }], ["eq", "id", "a1"], ["getSession"]]);
    expect(notice).toEqual({ sent: false, reason: "not signed in" });
    expect(keys(spy)).toEqual([["admin", "applications"], ["admin", "members"], ["directory"], ["public-profiles"], ["intros"]]);
  });

  it("a member status change updates the profile and refreshes members, applications, directory, public cards and intros", async () => {
    const { qc, spy } = setup();
    fake.results = [ok];
    await new MutationObserver(qc, setMemberStatusMutation(qc)).mutate({ id: "u1", status: "declined" });
    expect(fake.calls).toEqual([["from", "profiles"], ["update", { status: "declined" }], ["eq", "id", "u1"]]);
    expect(keys(spy)).toEqual([["admin", "members"], ["admin", "applications"], ["directory"], ["public-profiles"], ["intros"]]);
  });

  it("a booking status change updates the booking and refreshes admin bookings", async () => {
    const { qc, spy } = setup();
    fake.results = [ok];
    await new MutationObserver(qc, setBookingStatusMutation(qc)).mutate({ id: "b1", status: "confirmed" });
    expect(fake.calls).toEqual([["from", "headshot_bookings"], ["update", { status: "confirmed" }], ["eq", "id", "b1"]]);
    expect(keys(spy)).toEqual([["admin", "bookings"]]);
  });

  it("rejects with the update error and invalidates nothing", async () => {
    const { qc, spy } = setup();
    fake.results = [{ data: null, error: dbError }];
    await expect(new MutationObserver(qc, reviewApplicationMutation(qc)).mutate({ id: "a1", status: "approved" })).rejects.toBe(dbError);
    expect(spy).not.toHaveBeenCalled();
  });

  // Listed literally on purpose: a rename cascades to profiles and events, so every cache showing one refreshes.
  const hoodKeys = [
    ["neighborhoods"], ["admin", "neighborhoods"], ["admin", "members"], ["directory"], ["public-profiles"], ["intros"], ["profile"], ["events"],
  ];
  const logoOptions = (type: string) => ({ upsert: true, contentType: type, cacheControl: "60" });

  it("creating a neighborhood inserts the row first, then uploads the logo to <slug>.<ext>, then saves logo_path", async () => {
    const { qc, spy } = setup();
    const logo = new File(["x"], "Logo.PNG", { type: "image/png" });
    fake.results = [ok, ok, ok];
    await new MutationObserver(qc, createNeighborhoodMutation(qc)).mutate({
      name: " Woodside ", slug: "woodside", color: "#123456", sort_order: 8, logo,
    });
    expect(fake.calls).toEqual([
      ["from", "neighborhoods"],
      ["insert", { name: "Woodside", slug: "woodside", color: "#123456", sort_order: 8 }],
      ["upload", "neighborhood-logos", "woodside.png", logo, logoOptions("image/png")],
      ["from", "neighborhoods"], ["update", { logo_path: "woodside.png" }], ["eq", "slug", "woodside"],
    ]);
    expect(keys(spy)).toEqual(hoodKeys);
  });

  it("creating without a logo only inserts the row", async () => {
    fake.results = [ok];
    await createNeighborhood({ name: "Woodside", slug: "woodside", color: "#123456", sort_order: 0 });
    expect(fake.calls).toEqual([
      ["from", "neighborhoods"], ["insert", { name: "Woodside", slug: "woodside", color: "#123456", sort_order: 0 }],
    ]);
  });

  it("a failed insert (e.g. a duplicate slug) never touches storage", async () => {
    const duplicate = { code: "23505", message: "duplicate key value violates unique constraint" };
    fake.results = [{ data: null, error: duplicate }];
    const logo = new File(["x"], "l.webp", { type: "image/webp" });
    await expect(createNeighborhood({ name: "Woodside", slug: "woodside", color: "#123456", sort_order: 0, logo })).rejects.toBe(duplicate);
    expect(fake.calls.map((c) => c[0])).toEqual(["from", "insert"]);
  });

  it.each([
    ["the upload", [ok, { data: null, error: { message: "storage offline" } }]],
    ["the logo_path update", [ok, ok, { data: null, error: { message: "storage offline" } }]],
  ])("keeps the new row and says so when %s fails, still refreshing the lists", async (_step, results) => {
    const { qc, spy } = setup();
    fake.results = results;
    const logo = new File(["x"], "l.webp", { type: "image/webp" });
    await expect(
      new MutationObserver(qc, createNeighborhoodMutation(qc)).mutate({ name: "Woodside", slug: "woodside", color: "#123456", sort_order: 0, logo }),
    ).rejects.toThrow("Neighborhood added, but the logo didn't upload: storage offline");
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

  it("updating saves the row fields first (never the slug), then the logo and its path, and refreshes everything that shows it", async () => {
    const { qc, spy } = setup();
    const logo = new File(["x"], "l.png", { type: "image/png" });
    fake.results = [ok, ok, ok];
    const out = await new MutationObserver(qc, updateNeighborhoodMutation(qc)).mutate({ ...edit, previousLogoPath: "astoria.png", logo });
    expect(fake.calls).toEqual([
      ["from", "neighborhoods"], ["update", { name: "Astoria North", color: "#ff9a1f", active: false, sort_order: 2 }], ["eq", "slug", "astoria"],
      ["upload", "neighborhood-logos", "astoria.png", logo, logoOptions("image/png")],
      ["from", "neighborhoods"], ["update", { logo_path: "astoria.png" }], ["eq", "slug", "astoria"],
    ]);
    expect(out).toEqual({});
    expect(keys(spy)).toEqual(hoodKeys);
  });

  it("a png → webp change removes the old object after the new path is saved", async () => {
    const logo = new File(["x"], "l.webp", { type: "image/webp" });
    fake.results = [ok, ok, ok, ok];
    expect(await updateNeighborhood({ ...edit, previousLogoPath: "astoria.png", logo })).toEqual({});
    expect(fake.calls.slice(3)).toEqual([
      ["upload", "neighborhood-logos", "astoria.webp", logo, logoOptions("image/webp")],
      ["from", "neighborhoods"], ["update", { logo_path: "astoria.webp" }], ["eq", "slug", "astoria"],
      ["remove", "neighborhood-logos", ["astoria.png"]],
    ]);
  });

  it("a failed removal of the old logo is a warning, not a failed save", async () => {
    const logo = new File(["x"], "l.webp", { type: "image/webp" });
    fake.results = [ok, ok, ok, { data: null, error: { message: "not allowed" } }];
    const out = await updateNeighborhood({ ...edit, previousLogoPath: "astoria.png", logo });
    expect(out.warning).toMatch(/old logo .*astoria\.png.* not allowed/);
  });

  it("a failed row update never touches storage", async () => {
    const logo = new File(["x"], "l.webp", { type: "image/webp" });
    fake.results = [{ data: null, error: dbError }];
    await expect(updateNeighborhood({ ...edit, previousLogoPath: null, logo })).rejects.toBe(dbError);
    expect(fake.calls.map((c) => c[0])).toEqual(["from", "update", "eq"]);
  });

  it("a failed logo upload after the fields saved says the changes were kept", async () => {
    const { qc, spy } = setup();
    const logo = new File(["x"], "l.webp", { type: "image/webp" });
    fake.results = [ok, { data: null, error: { message: "storage offline" } }];
    await expect(
      new MutationObserver(qc, updateNeighborhoodMutation(qc)).mutate({ ...edit, previousLogoPath: null, logo }),
    ).rejects.toThrow("Changes saved, but the logo didn't upload: storage offline");
    expect(keys(spy)).toEqual(hoodKeys);
  });

  it("updating without a logo only saves the row fields", async () => {
    fake.results = [ok];
    expect(await updateNeighborhood({ ...edit, previousLogoPath: "astoria.png" })).toEqual({});
    expect(fake.calls).toEqual([
      ["from", "neighborhoods"], ["update", { name: "Astoria North", color: "#ff9a1f", active: false, sort_order: 2 }], ["eq", "slug", "astoria"],
    ]);
  });

  it("rejects an invalid update before any network call", async () => {
    await expect(updateNeighborhood({ ...edit, color: "#ff9a1", previousLogoPath: null })).rejects.toThrow(/color/i);
    const logo = new File(["x"], "l.gif", { type: "image/gif" });
    await expect(updateNeighborhood({ ...edit, previousLogoPath: null, logo })).rejects.toThrow(/PNG or WebP/);
    expect(fake.calls).toEqual([]);
  });
});
