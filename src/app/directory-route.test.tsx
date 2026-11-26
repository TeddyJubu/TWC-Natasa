// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";

vi.mock("@/features/members/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/roster/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { fake } from "@/test/fake-fns";
import { Route } from "@/routes/_authenticated/directory";

vi.spyOn(Route, "useRouteContext").mockReturnValue({ user: { id: "u1", name: "Rosa", email: "u1@x.test" } } as never);
const Page = Route.options.component as React.ComponentType;
afterEach(() => {
  cleanup();
  fake.reset();
});

const member = (i: number, name: string, neighborhood: string) => ({
  id: `m${i}`, name, role: "Owner", business: `Shop ${i}`, neighborhood, specialty: "", bio: "", lookingFor: "", catalogueNumber: i,
});
// 13 members: one more than a sheet holds.
const MEMBERS = [member(3, "Lucía Ferreira", "Woodside"), ...Array.from({ length: 12 }, (_, i) => member(i + 10, `Member ${i + 10}`, "Astoria"))];
const seed: [unknown[], unknown][] = [
  [["viewer"], { signedIn: true, member: true, admin: false }],
  [["profile", "u1"], { profile: { full_name: "Rosa", status: "approved", catalogue_number: 1 }, avatarUrl: undefined }],
  [["directory"], MEMBERS],
];
const sheet = () => screen.getByRole("group", { name: /Members, page/ });
// ponytail: every name here is invented; the repository is public, so no real member ever appears in a test.

describe("/directory", () => {
  it("stays out of search", () => {
    const meta = (Route.options.head as () => { meta: Record<string, string>[] })().meta;
    expect(meta).toContainEqual({ name: "robots", content: "noindex" });
  });

  it("shows twelve directory cards a page under one h1, beside the constellation map", () => {
    renderWithQueries(<Page />, seed);
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Women-owned, nearby"]);
    expect(within(sheet()).getAllByRole("article")).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(within(sheet()).getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    // Every member the map can place is a star at her neighborhood (Woodside and Astoria are both drawn).
    expect(screen.getByRole("img", { name: /Planning-style map/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lucía Ferreira, Woodside" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /, Astoria$/ })).toHaveLength(12);
  });

  it("opens her card from the grid or the map, with her page and nothing she didn't publish", () => {
    renderWithQueries(<Page />, seed);
    fireEvent.click(screen.getByRole("button", { name: "View Lucía Ferreira’s profile" }));
    const card = screen.getByRole("dialog", { name: "Lucía Ferreira" });
    expect(within(card).getByText("Woodside · Western Queens")).toBeTruthy();
    expect(within(card).getByRole("link", { name: /Open her page/ }).getAttribute("href")).toBe("/members/lucia-ferreira-3");
    expect(within(card).queryByText("Craft")).toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Lucía Ferreira, Woodside" }));
    expect(screen.getByRole("dialog", { name: "Lucía Ferreira" })).toBeTruthy();
  });

  it("links her website only when it is an http(s) URL", () => {
    const withSite = (website: string) => [...seed.slice(0, 2), [["directory"], [{ ...MEMBERS[0], website }]]] as [unknown[], unknown][];
    renderWithQueries(<Page />, withSite("javascript:alert(1)"));
    fireEvent.click(screen.getByRole("button", { name: "View Lucía Ferreira’s profile" }));
    expect(screen.queryByRole("link", { name: /Visit her website/ })).toBeNull();
    cleanup();
    renderWithQueries(<Page />, withSite("https://cortado.example"));
    fireEvent.click(screen.getByRole("button", { name: "View Lucía Ferreira’s profile" }));
    expect(screen.getByRole("link", { name: /Visit her website/ }).getAttribute("href")).toBe("https://cortado.example");
  });

  it("filters by constellation, by neighborhood and by an accent-free search", () => {
    renderWithQueries(<Page />, seed);
    fireEvent.click(screen.getByRole("button", { name: "Woodside 1" }));
    expect(within(sheet()).getAllByRole("article")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "All 13" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search members" }), { target: { value: "lucia" } });
    expect(within(sheet()).getAllByRole("heading").map((h) => h.textContent)).toEqual(["Lucía Ferreira"]);
    expect(screen.getByText("1 of 13 match")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search members" }), { target: { value: "" } });
    // North Brooklyn has none of them; the map's constellation and the select agree.
    fireEvent.click(screen.getByRole("button", { name: "Show members in North Brooklyn" }));
    expect((screen.getByRole("combobox", { name: "Constellation" }) as HTMLSelectElement).value).toBe("nb");
    expect(screen.getByText("No members match yet.")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Constellation" }), { target: { value: "wq" } });
    expect(within(sheet()).getAllByRole("article")).toHaveLength(12);
  });

  it("offers a way back from a search nobody matches", () => {
    renderWithQueries(<Page />, seed);
    fireEvent.click(screen.getByRole("button", { name: "Woodside 1" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search members" }), { target: { value: "nobody-here" } });
    expect(screen.getByText("No members match yet.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show everyone" }));
    expect((screen.getByRole("searchbox", { name: "Search members" }) as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "All 13" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("tells a declined account the truth and where to ask, with no promise of entry and no cards", async () => {
    renderWithQueries(<Page />, [
      [["viewer"], { signedIn: true, member: false, admin: false, declined: true }],
      [["profile", "u1"], { profile: { full_name: "Rosa", status: "declined", catalogue_number: null }, avatarUrl: undefined }],
    ]);
    expect(screen.getByText(/your application wasn’t approved/i)).toBeTruthy();
    expect(screen.queryByText(/welcomed in/i)).toBeNull();
    expect(screen.getByRole("link", { name: /contact us/i }).getAttribute("href")).toBe("/contact");
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(screen.queryByRole("group", { name: /Members, page/ })).toBeNull();
    expect(fake.calls).not.toContainEqual(["directoryFn"]);
    expect(fake.calls).toContainEqual(["rosterFn"]); // empty (null here): the site isn't behind its PIN
  });

  it("shows anyone else signed in the club's roster while the site is behind its PIN, never the database", () => {
    renderWithQueries(<Page />, [
      [["viewer"], { signedIn: true, member: false, admin: false, declined: false }],
      [["profile", "u1"], { profile: { full_name: "Rosa", status: "pending", catalogue_number: null }, avatarUrl: undefined }],
      [["roster"], { leads: {}, members: [{ name: "Ada Roster", hood: "Greenpoint", constellation: "NB", photo: "/media/roster/ada.webp", role: "Florist", founder: true }] }],
    ]);
    expect(screen.getByText(/It unlocks once you’re welcomed in\./)).toBeTruthy();
    const card = within(sheet()).getByRole("article");
    expect(within(card).getByRole("heading", { name: "Ada Roster" })).toBeTruthy();
    expect(within(card).getByText("Founder")).toBeTruthy();
    expect(within(card).getByText("Greenpoint · North Brooklyn")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ada Roster, Greenpoint" })).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "View Ada Roster’s profile" }));
    expect(within(screen.getByRole("dialog", { name: "Ada Roster" })).queryByRole("link")).toBeNull();
    expect(fake.calls).not.toContainEqual(["directoryFn"]);
  });

  it("shows a pending account no member at all, only that the directory unlocks once she's welcomed in", async () => {
    renderWithQueries(<Page />, [
      [["viewer"], { signedIn: true, member: false, admin: false, declined: false }],
      [["profile", "u1"], { profile: { full_name: "Rosa", status: "pending", catalogue_number: null }, avatarUrl: undefined }],
    ]);
    expect(screen.getByText(/The directory is for members\. It unlocks once you’re welcomed in\./)).toBeTruthy();
    await act(() => new Promise((r) => setTimeout(r, 20)));
    // Her roster is empty once the PIN is lifted: no cards, no search, no map.
    expect(screen.queryByRole("group", { name: /Members, page/ })).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("img", { name: /Planning-style map/ })).toBeNull();
    expect(fake.calls).not.toContainEqual(["directoryFn"]);
  });
});
