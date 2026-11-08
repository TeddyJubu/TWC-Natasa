import { beforeEach, describe, expect, it, vi } from "vitest";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { fake } from "@/test/fake-supabase";

vi.mock("@/app/supabase", async () => (await import("@/test/fake-supabase")).fakeSupabaseModule);

import { avatarUrls, directoryQuery, introsQuery, profileQuery, publicProfilesQuery, viewerQuery } from "./queries";
import { saveProfile, saveProfileMutation, uploadAvatar, uploadAvatarMutation } from "./mutations";

const run = (q: { queryFn?: unknown }) => (q.queryFn as (c: unknown) => Promise<unknown>)({});
const dbError = { code: "42501", message: "permission denied" };

const dirRow = {
  id: "u1", full_name: "Rosa Diaz", role_title: "Founder", business: "Bakery", neighborhood: "Astoria",
  specialty: "Food", bio: "", looking_for: "", catalogue_number: 3, avatar_path: "u1/a.jpg", website: "",
};
const profileRow = { ...dirRow, status: "approved", directory_visible: true, member_since: null };

beforeEach(() => fake.reset());

describe("avatarUrls", () => {
  it("skips the request when there are no paths", async () => {
    expect(await avatarUrls([null, undefined])).toEqual({});
    expect(fake.calls).toEqual([]);
  });

  it("maps signed urls by path", async () => {
    fake.results = [{ data: [{ path: "u1/a.jpg", signedUrl: "https://signed/a" }], error: null }];
    expect(await avatarUrls(["u1/a.jpg", null])).toEqual({ "u1/a.jpg": "https://signed/a" });
    expect(fake.calls).toEqual([["createSignedUrls", "avatars", ["u1/a.jpg"], 3600]]);
  });

  it("throws instead of ignoring a storage error", async () => {
    fake.results = [{ data: null, error: dbError }];
    await expect(avatarUrls(["u1/a.jpg"])).rejects.toBe(dbError);
  });
});

describe("directoryQuery", () => {
  it("uses the directory key", () => {
    expect(directoryQuery.queryKey).toEqual(["directory"]);
  });

  it("maps public_directory rows with signed portraits and catalogue numbers", async () => {
    fake.results = [
      { data: [dirRow], error: null },
      { data: [{ path: "u1/a.jpg", signedUrl: "https://signed/a" }], error: null },
    ];
    const out = (await run(directoryQuery)) as { image: string; catalogueNumber: number; website?: string }[];
    expect(fake.calls[0]).toEqual(["rpc", "public_directory"]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "u1", name: "Rosa Diaz", image: "https://signed/a", catalogueNumber: 3 });
    expect(out[0].website).toBeUndefined();
  });

  it("signs business logos with the portraits and puts them on the profile", async () => {
    fake.results = [
      { data: [{ ...dirRow, business_logo_url: "u1/logo-1.png" }], error: null },
      { data: [{ path: "u1/a.jpg", signedUrl: "https://signed/a" }, { path: "u1/logo-1.png", signedUrl: "https://signed/logo" }], error: null },
    ];
    const out = (await run(directoryQuery)) as { image: string; logo?: string }[];
    expect(fake.calls[1]).toEqual(["createSignedUrls", "avatars", ["u1/a.jpg", "u1/logo-1.png"], 3600]);
    expect(out[0]).toMatchObject({ image: "https://signed/a", logo: "https://signed/logo" });
  });

  it("throws the rpc error", async () => {
    fake.results = [{ data: null, error: dbError }];
    await expect(run(directoryQuery)).rejects.toBe(dbError);
  });
});

describe("viewerQuery", () => {
  it("is keyed as the viewer", () => {
    expect(viewerQuery.queryKey).toEqual(["viewer"]);
  });

  it("is a signed-out visitor without a session, and skips the rpcs", async () => {
    fake.results = [{ data: { session: null }, error: null }];
    expect(await run(viewerQuery)).toEqual({ signedIn: false, member: false, admin: false });
    expect(fake.calls).toEqual([["getSession"]]);
  });

  it.each([
    [true, false],
    [false, false],
    [false, true],
    [true, true],
  ])("asks is_member() and is_admin() for a signed-in viewer (member=%s, admin=%s)", async (member, admin) => {
    fake.results = [{ data: { session: { user: { id: "u1" } } }, error: null }, { data: member, error: null }, { data: admin, error: null }];
    expect(await run(viewerQuery)).toEqual({ signedIn: true, member, admin });
    expect(fake.calls).toEqual([["getSession"], ["rpc", "is_member"], ["rpc", "is_admin"]]);
  });

  it("counts only exactly true as member or admin", async () => {
    fake.results = [{ data: { session: { user: { id: "u1" } } }, error: null }, { data: "true", error: null }, { data: 1, error: null }];
    expect(await run(viewerQuery)).toEqual({ signedIn: true, member: false, admin: false });
  });

  it("throws session and is_member errors", async () => {
    fake.results = [{ data: { session: null }, error: dbError }];
    await expect(run(viewerQuery)).rejects.toBe(dbError);
    fake.results = [{ data: { session: { user: { id: "u1" } } }, error: null }, { data: null, error: dbError }, { data: true, error: null }];
    await expect(run(viewerQuery)).rejects.toBe(dbError);
  });

  it("treats an is_admin error as not an admin, without failing the viewer", async () => {
    fake.results = [{ data: { session: { user: { id: "u1" } } }, error: null }, { data: true, error: null }, { data: null, error: dbError }];
    expect(await run(viewerQuery)).toEqual({ signedIn: true, member: true, admin: false });
  });
});

describe("publicProfilesQuery", () => {
  const { id: _id, ...publicRow } = dirRow;

  it("uses its own key, separate from the members-only directory", () => {
    expect(publicProfilesQuery.queryKey).toEqual(["public-profiles"]);
  });

  it("maps public_profiles rows keyed by catalogue number, with signed portraits", async () => {
    fake.results = [
      { data: [publicRow], error: null },
      { data: [{ path: "u1/a.jpg", signedUrl: "https://signed/a" }], error: null },
    ];
    const out = (await run(publicProfilesQuery)) as { id: string; image: string; catalogueNumber: number }[];
    expect(fake.calls[0]).toEqual(["rpc", "public_profiles"]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "catalogue-3", name: "Rosa Diaz", image: "https://signed/a", catalogueNumber: 3 });
  });

  it("returns an empty list without signing anything", async () => {
    fake.results = [{ data: [], error: null }];
    expect(await run(publicProfilesQuery)).toEqual([]);
    expect(fake.calls).toEqual([["rpc", "public_profiles"]]);
  });

  it("throws the rpc error", async () => {
    fake.results = [{ data: null, error: dbError }];
    await expect(run(publicProfilesQuery)).rejects.toBe(dbError);
  });
});

describe("profileQuery", () => {
  it("is keyed by user id", () => {
    expect(profileQuery("u1").queryKey).toEqual(["profile", "u1"]);
  });

  it("loads the row and its signed avatar", async () => {
    fake.results = [
      { data: profileRow, error: null },
      { data: [{ path: "u1/a.jpg", signedUrl: "https://signed/a" }], error: null },
    ];
    expect(await run(profileQuery("u1"))).toEqual({ profile: profileRow, avatarUrl: "https://signed/a", logoUrl: undefined });
    expect(fake.calls.slice(0, 4)).toEqual([["from", "profiles"], ["select", "*"], ["eq", "id", "u1"], ["maybeSingle"]]);
  });

  it("signs her business logo too", async () => {
    fake.results = [
      { data: { ...profileRow, business_logo_url: "u1/logo-1.png" }, error: null },
      { data: [{ path: "u1/a.jpg", signedUrl: "https://signed/a" }, { path: "u1/logo-1.png", signedUrl: "https://signed/logo" }], error: null },
    ];
    expect(await run(profileQuery("u1"))).toMatchObject({ avatarUrl: "https://signed/a", logoUrl: "https://signed/logo" });
  });

  it("returns null when the profile row is missing", async () => {
    fake.results = [{ data: null, error: null }];
    expect(await run(profileQuery("u1"))).toBeNull();
  });

  it("throws the query error", async () => {
    fake.results = [{ data: null, error: dbError }];
    await expect(run(profileQuery("u1"))).rejects.toBe(dbError);
  });
});

describe("introsQuery", () => {
  const other = (id: string, neighborhood: string) => ({ ...profileRow, id, full_name: id, neighborhood, avatar_path: null });

  it("is keyed by user and neighborhood", () => {
    expect(introsQuery("u1", "Astoria").queryKey).toEqual(["intros", "u1", "Astoria"]);
  });

  const base = [["from", "profiles"], ["select", "*"], ["neq", "id", "u1"], ["eq", "status", "approved"], ["eq", "directory_visible", true]];

  it("asks the database for same-neighborhood members first, then tops up from elsewhere (max 4)", async () => {
    fake.results = [
      { data: [other("b", "Astoria"), other("d", "Astoria")], error: null },
      { data: [other("a", "Sunnyside"), other("c", "Elmhurst")], error: null },
    ];
    const out = (await run(introsQuery("u1", "Astoria"))) as { id: string }[];
    expect(fake.calls).toEqual([
      ...base, ["eq", "neighborhood", "Astoria"], ["order", "catalogue_number"], ["limit", 4],
      ...base, ["neq", "neighborhood", "Astoria"], ["order", "catalogue_number"], ["limit", 2],
    ]);
    expect(out.map((m) => m.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("skips the second query when the neighborhood fills all four", async () => {
    fake.results = [{ data: ["a", "b", "c", "d"].map((id) => other(id, "Astoria")), error: null }];
    expect(((await run(introsQuery("u1", "Astoria"))) as unknown[]).length).toBe(4);
    expect(fake.calls.filter((c) => c[0] === "from")).toHaveLength(1);
  });

  it("is keyed by a null neighborhood too", () => {
    expect(introsQuery("u1", null).queryKey).toEqual(["intros", "u1", null]);
  });

  it("skips the same-neighborhood query when she has no neighborhood", async () => {
    fake.results = [{ data: [other("a", "Sunnyside"), other("b", "Astoria")], error: null }];
    const out = (await run(introsQuery("u1", null))) as { id: string }[];
    expect(fake.calls).toEqual([...base, ["order", "catalogue_number"], ["limit", 4]]);
    expect(out.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("throws the top-up query error", async () => {
    fake.results = [{ data: [], error: null }, { data: null, error: dbError }];
    await expect(run(introsQuery("u1", "Astoria"))).rejects.toBe(dbError);
  });

  it("returns an empty list when there are no other members", async () => {
    fake.results = [{ data: [], error: null }, { data: [], error: null }];
    expect(await run(introsQuery("u1", "Astoria"))).toEqual([]);
  });

  it("throws the query error", async () => {
    fake.results = [{ data: null, error: dbError }];
    await expect(run(introsQuery("u1", "Astoria"))).rejects.toBe(dbError);
  });
});

describe("saveProfile", () => {
  it("updates the member's row and returns the saved row", async () => {
    fake.results = [{ data: profileRow, error: null }];
    expect(await saveProfile("u1", { full_name: "Rosa" })).toBe(profileRow);
    expect(fake.calls).toEqual([["from", "profiles"], ["update", { full_name: "Rosa" }], ["eq", "id", "u1"], ["select"], ["single"]]);
  });

  it("throws the update error", async () => {
    fake.results = [{ data: null, error: dbError }];
    await expect(saveProfile("u1", {})).rejects.toBe(dbError);
  });
});

describe("uploadAvatar", () => {
  const file = new File(["x"], "me.png", { type: "image/png" });

  it("uploads under the member's folder, then points the profile at it", async () => {
    vi.spyOn(Date, "now").mockReturnValue(42);
    fake.results = [{ data: {}, error: null }, { data: profileRow, error: null }];
    expect(await uploadAvatar("u1", file)).toBe(profileRow);
    expect(fake.calls).toEqual([
      ["upload", "avatars", "u1/avatar-42.png", file, { upsert: true }],
      ["from", "profiles"], ["update", { avatar_path: "u1/avatar-42.png" }], ["eq", "id", "u1"], ["select"], ["single"],
    ]);
  });

  it("defaults to .jpg when the file name has no extension", async () => {
    vi.spyOn(Date, "now").mockReturnValue(42);
    fake.results = [{ data: {}, error: null }, { data: profileRow, error: null }];
    await uploadAvatar("u1", new File(["x"], "portrait", { type: "image/jpeg" }));
    expect(fake.calls[0][2]).toBe("u1/avatar-42.jpg");
  });

  it.each([
    ["too large", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" }), /5 MB/],
    ["not an image type we accept", new File(["x"], "anim.gif", { type: "image/gif" }), /JPG, PNG or WebP/],
  ])("rejects a file that is %s before uploading anything", async (_label, bad, message) => {
    await expect(uploadAvatar("u1", bad)).rejects.toThrow(message);
    expect(fake.calls).toEqual([]);
  });

  it("accepts a 5 MB webp", async () => {
    fake.results = [{ data: {}, error: null }, { data: profileRow, error: null }];
    await uploadAvatar("u1", new File([new Uint8Array(5 * 1024 * 1024)], "me.webp", { type: "image/webp" }));
    expect(fake.calls[0][0]).toBe("upload");
  });

  it("throws the storage error and skips the profile update", async () => {
    fake.results = [{ data: null, error: dbError }];
    await expect(uploadAvatar("u1", file)).rejects.toBe(dbError);
    expect(fake.calls.some((c) => c[0] === "from")).toBe(false);
  });

  it("throws when the profile update after upload fails", async () => {
    fake.results = [{ data: {}, error: null }, { data: null, error: dbError }];
    await expect(uploadAvatar("u1", file)).rejects.toBe(dbError);
  });
});

describe("member mutation cache effects", () => {
  const keys = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);

  it("saving writes the row into the profile cache and refreshes directory, intros and public cards", async () => {
    const qc = new QueryClient();
    qc.setQueryData(["profile", "u1"], { profile: { id: "u1", full_name: "Old" }, avatarUrl: "https://signed/a" });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const saved = { ...profileRow, full_name: "New" };
    fake.results = [{ data: saved, error: null }];
    await new MutationObserver(qc, saveProfileMutation(qc, "u1")).mutate({ full_name: "New" });
    expect(qc.getQueryData(["profile", "u1"])).toEqual({ profile: saved, avatarUrl: "https://signed/a" });
    expect(keys(spy)).toEqual([["directory"], ["intros"], ["public-profiles"]]);
  });

  it("uploading refreshes the profile (new signed url), directory, intros and public cards", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");
    fake.results = [{ data: {}, error: null }, { data: profileRow, error: null }];
    await new MutationObserver(qc, uploadAvatarMutation(qc, "u1")).mutate(new File(["x"], "me.png", { type: "image/png" }));
    expect(keys(spy)).toEqual(expect.arrayContaining([["profile", "u1"], ["directory"], ["intros"], ["public-profiles"]]));
    expect(keys(spy)).toHaveLength(4);
  });
});
