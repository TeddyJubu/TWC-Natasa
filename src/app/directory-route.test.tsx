// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";

vi.mock("@/features/members/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
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

describe("/directory", () => {
  it("stays out of search", () => {
    const meta = (Route.options.head as () => { meta: Record<string, string>[] })().meta;
    expect(meta).toContainEqual({ name: "robots", content: "noindex" });
  });

  it("shows twelve members a page under one h1", () => {
    renderWithQueries(<Page />, seed);
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Members"]);
    expect(within(sheet()).getAllByRole("button")).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(within(sheet()).getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
  });

  it("shows a chosen member beside the list, and puts her away", () => {
    renderWithQueries(<Page />, seed);
    const card = screen.getByRole("button", { name: /^Lucía Ferreira/ });
    fireEvent.click(card);
    expect(card.getAttribute("aria-pressed")).toBe("true");
    const pass = screen.getByRole("complementary", { name: "Chosen member" });
    expect(within(pass).getByRole("heading", { name: "Lucía Ferreira" })).toBeTruthy();
    expect(within(pass).getByRole("link", { name: /Open her page/ }).getAttribute("href")).toBe("/members/lucia-ferreira-3");
    fireEvent.click(card);
    expect(within(pass).getByRole("heading", { name: "No one chosen yet" })).toBeTruthy();
  });

  it("links her website only when it is an http(s) URL", () => {
    const withSite = (website: string) => [...seed.slice(0, 2), [["directory"], [{ ...MEMBERS[0], website }]]] as [unknown[], unknown][];
    renderWithQueries(<Page />, withSite("javascript:alert(1)"));
    fireEvent.click(screen.getByRole("button", { name: /^Lucía Ferreira/ }));
    expect(screen.queryByRole("link", { name: /Visit her website/ })).toBeNull();
    cleanup();
    renderWithQueries(<Page />, withSite("https://cortado.example"));
    fireEvent.click(screen.getByRole("button", { name: /^Lucía Ferreira/ }));
    expect(screen.getByRole("link", { name: /Visit her website/ }).getAttribute("href")).toBe("https://cortado.example");
  });

  it("filters by neighborhood and by an accent-free search", () => {
    renderWithQueries(<Page />, seed);
    fireEvent.click(screen.getByRole("button", { name: "Woodside 1" }));
    expect(within(sheet()).getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "All 13" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search members" }), { target: { value: "lucia" } });
    expect(within(sheet()).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Lucía Ferreira, Owner, in Woodside"]);
    expect(screen.getByText("1 of 13 match")).toBeTruthy();
  });

  it("offers a way back from a search nobody matches", () => {
    renderWithQueries(<Page />, seed);
    fireEvent.click(screen.getByRole("button", { name: "Woodside 1" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search members" }), { target: { value: "nobody-here" } });
    expect(screen.getByText("No one matches.")).toBeTruthy();
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
  });

  it("shows a pending account no member at all, only that the directory unlocks once she's welcomed in", async () => {
    renderWithQueries(<Page />, [
      [["viewer"], { signedIn: true, member: false, admin: false, declined: false }],
      [["profile", "u1"], { profile: { full_name: "Rosa", status: "pending", catalogue_number: null }, avatarUrl: undefined }],
    ]);
    expect(screen.getByText(/The directory is for members\. It unlocks once you’re welcomed in\./)).toBeTruthy();
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(screen.queryByRole("group", { name: /Members, page/ })).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(fake.calls).not.toContainEqual(["directoryFn"]);
  });
});
