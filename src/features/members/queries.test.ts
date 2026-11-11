import { beforeEach, describe, expect, it, vi } from "vitest";
import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import { fake } from "@/test/fake-fns";

vi.mock("@/features/members/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/app/api", async () => (await import("@/test/fake-fns")).fakeApi);
const resize = vi.hoisted(() => ({ fn: null as null | ((file: File, options: { maxEdge: number }) => Promise<File>) }));
vi.mock("@/app/resize-image", async (orig) => {
  const real = await orig<typeof import("@/app/resize-image")>();
  return { ...real, resizeImage: (file: File, options: { maxEdge: number }) => (resize.fn ?? real.resizeImage)(file, options) };
});

import { directoryQuery, introsQuery, profileQuery, publicProfilesQuery, viewerQuery } from "./queries";
import { removeLogo, saveProfile, saveProfileMutation, uploadAvatar, uploadAvatarMutation, uploadLogo } from "./mutations";

const run = (q: { queryFn?: unknown }) => (q.queryFn as (c: unknown) => Promise<unknown>)({});
const card = { id: "u1", name: "Rosa Diaz", role: "Founder", business: "Bakery", neighborhood: "Astoria", specialty: "Food",
  bio: "", lookingFor: "", image: "/media/avatars/u1/avatar-1.png", imageAlt: "Portrait of Rosa Diaz", catalogueNumber: 3 };
const profileRow = { id: "u1", full_name: "Rosa Diaz", status: "approved", directory_visible: true };

beforeEach(() => { fake.reset(); resize.fn = null; });

describe("directoryQuery", () => {
  it("uses the directory key and returns the server's cards as they are", async () => {
    expect(directoryQuery.queryKey).toEqual(["directory"]);
    fake.results = [[card]];
    expect(await run(directoryQuery)).toEqual([card]);
    expect(fake.calls).toEqual([["directoryFn"]]);
  });

  it("throws a server error instead of showing an empty directory", async () => {
    fake.results = [new Error("Please sign in.")];
    await expect(run(directoryQuery)).rejects.toThrow("Please sign in.");
  });
});

describe("viewerQuery", () => {
  it("is keyed as the viewer", () => {
    expect(viewerQuery.queryKey).toEqual(["viewer"]);
  });

  it("asks the server about this session (signed in, approved member, admin)", async () => {
    fake.results = [{ signedIn: true, member: true, admin: false }];
    expect(await run(viewerQuery)).toEqual({ signedIn: true, member: true, admin: false });
    expect(fake.calls).toEqual([["viewerFn"]]);
  });

  it("throws a failed check instead of guessing", async () => {
    fake.results = [new Error("offline")];
    await expect(run(viewerQuery)).rejects.toThrow("offline");
  });
});

describe("publicProfilesQuery", () => {
  it("uses its own key, separate from the members-only directory", async () => {
    expect(publicProfilesQuery.queryKey).toEqual(["public-profiles"]);
    fake.results = [[{ ...card, id: "catalogue-3" }]];
    expect(await run(publicProfilesQuery)).toEqual([{ ...card, id: "catalogue-3" }]);
    expect(fake.calls).toEqual([["publicProfilesFn"]]);
  });

  it("stays fresh after the loader, so the page's query does not fetch again", async () => {
    const qc = new QueryClient();
    fake.results = [[card], [card]];
    await qc.ensureQueryData(publicProfilesQuery);
    const unsubscribe = new QueryObserver(qc, publicProfilesQuery).subscribe(() => {});
    await new Promise((r) => setTimeout(r, 10));
    unsubscribe();
    expect(fake.calls).toEqual([["publicProfilesFn"]]);
  });
});

describe("profileQuery", () => {
  it("is keyed by user id and loads her own profile from the session", async () => {
    expect(profileQuery("u1").queryKey).toEqual(["profile", "u1"]);
    const data = { profile: profileRow, avatarUrl: "/media/avatars/u1/a.png", logoUrl: undefined };
    fake.results = [data];
    expect(await run(profileQuery("u1"))).toEqual(data);
    expect(fake.calls).toEqual([["ownProfileFn"]]);
  });

  it("returns null when the profile row is missing", async () => {
    fake.results = [null];
    expect(await run(profileQuery("u1"))).toBeNull();
  });
});

describe("introsQuery", () => {
  it("is keyed by user and neighborhood (null included) and passes the neighborhood", async () => {
    expect(introsQuery("u1", "Astoria").queryKey).toEqual(["intros", "u1", "Astoria"]);
    expect(introsQuery("u1", null).queryKey).toEqual(["intros", "u1", null]);
    fake.results = [[card], []];
    expect(await run(introsQuery("u1", "Astoria"))).toEqual([card]);
    await run(introsQuery("u1", null));
    expect(fake.calls).toEqual([["introsFn", { neighborhood: "Astoria" }], ["introsFn", { neighborhood: null }]]);
  });
});

describe("saveProfile", () => {
  it("sends only the patch (the server takes the id from the session) and returns the saved row", async () => {
    fake.results = [profileRow];
    expect(await saveProfile("u1", { full_name: "Rosa" })).toBe(profileRow);
    expect(fake.calls).toEqual([["saveProfileFn", { full_name: "Rosa" }]]);
  });

  it("throws the server's error", async () => {
    fake.results = [new Error("You can’t change status.")];
    await expect(saveProfile("u1", {})).rejects.toThrow("You can’t change status.");
  });
});

describe("image uploads", () => {
  const file = new File(["x"], "me.png", { type: "image/png" });
  const sent = () => fake.calls[0][1] as FormData;

  it("send the file and its kind as FormData", async () => {
    fake.results = [profileRow];
    expect(await uploadAvatar("u1", file)).toBe(profileRow);
    expect(fake.calls[0][0]).toBe("/api/images");
    expect([sent().get("kind"), (sent().get("file") as File).name]).toEqual(["avatar", "me.png"]);
    fake.reset();
    fake.results = [profileRow];
    await uploadLogo("u1", file);
    expect(sent().get("kind")).toBe("logo");
  });

  it.each([
    ["too large", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" }), /5 MB/],
    ["not an image type we accept", new File(["x"], "anim.gif", { type: "image/gif" }), /JPG, PNG or WebP/],
  ])("reject a file that is %s before uploading anything", async (_label, bad, message) => {
    await expect(uploadAvatar("u1", bad)).rejects.toThrow(message);
    expect(fake.calls).toEqual([]);
  });

  it("accept a 5 MB webp", async () => {
    fake.results = [profileRow];
    await uploadAvatar("u1", new File([new Uint8Array(5 * 1024 * 1024)], "me.webp", { type: "image/webp" }));
    expect(fake.calls[0][0]).toBe("/api/images");
  });

  it("shrink a portrait to 1600px and a logo to 512px before the size check and the upload", async () => {
    const seen: number[] = [];
    resize.fn = async (_file, { maxEdge }) => { seen.push(maxEdge); return new File(["small"], "me.webp", { type: "image/webp" }); };
    fake.results = [profileRow, profileRow];
    await uploadAvatar("u1", new File([new Uint8Array(8 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" })); // over 5 MB as picked
    await uploadLogo("u1", file);
    expect(seen).toEqual([1600, 512]);
    expect((fake.calls[0][1] as FormData).get("file")).toMatchObject({ name: "me.webp", type: "image/webp" });
  });

  it("throw the server's error", async () => {
    fake.results = [new Error("Please choose a JPG, PNG or WebP image.")];
    await expect(uploadAvatar("u1", file)).rejects.toThrow(/JPG, PNG or WebP/);
  });

  it("removing her logo asks the server to clear and delete it", async () => {
    fake.results = [profileRow];
    await removeLogo("u1", "u1/logo-1.png");
    expect(fake.calls).toEqual([["removeLogoFn"]]);
  });
});

describe("member mutation cache effects", () => {
  const keys = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);

  it("saving writes the row into the profile cache and refreshes directory, intros and public cards", async () => {
    const qc = new QueryClient();
    qc.setQueryData(["profile", "u1"], { profile: { id: "u1", full_name: "Old" }, avatarUrl: "/media/avatars/u1/a.png" });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const saved = { ...profileRow, full_name: "New" };
    fake.results = [saved];
    await new MutationObserver(qc, saveProfileMutation(qc, "u1")).mutate({ full_name: "New" });
    expect(qc.getQueryData(["profile", "u1"])).toEqual({ profile: saved, avatarUrl: "/media/avatars/u1/a.png" });
    expect(keys(spy)).toEqual([["directory"], ["intros"], ["public-profiles"]]);
  });

  it("uploading refreshes the profile (new image url), directory, intros and public cards", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");
    fake.results = [profileRow];
    await new MutationObserver(qc, uploadAvatarMutation(qc, "u1")).mutate(new File(["x"], "me.png", { type: "image/png" }));
    expect(keys(spy)).toEqual(expect.arrayContaining([["profile", "u1"], ["directory"], ["intros"], ["public-profiles"]]));
    expect(keys(spy)).toHaveLength(4);
  });
});
