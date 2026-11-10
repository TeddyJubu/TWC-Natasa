// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";

vi.mock("@/features/members/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route } from "@/routes/_authenticated/directory";

vi.spyOn(Route, "useRouteContext").mockReturnValue({ user: { id: "u1", name: "Rosa", email: "u1@x.test" } } as never);
const Page = Route.options.component as React.ComponentType;
afterEach(cleanup);

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
const sheet = () => screen.getByRole("group", { name: /Member stamps/ });

describe("/directory", () => {
  it("stays out of search", () => {
    const meta = (Route.options.head as () => { meta: Record<string, string>[] })().meta;
    expect(meta).toContainEqual({ name: "robots", content: "noindex" });
  });

  it("prints twelve stamps a sheet under one h1", () => {
    renderWithQueries(<Page />, seed);
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Members"]);
    expect(within(sheet()).getAllByRole("button")).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Next sheet" }));
    expect(within(sheet()).getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText("Sheet 2 of 2")).toBeTruthy();
  });

  it("tears a stamp out onto the pass, and puts it back", () => {
    renderWithQueries(<Page />, seed);
    const stamp = screen.getByRole("button", { name: /^Lucía Ferreira/ });
    fireEvent.click(stamp);
    expect(stamp.getAttribute("aria-pressed")).toBe("true");
    const pass = screen.getByRole("complementary", { name: "Torn-out member" });
    expect(within(pass).getByRole("heading", { name: "Lucía Ferreira" })).toBeTruthy();
    expect(within(pass).getByRole("link", { name: /Open her page/ }).getAttribute("href")).toBe("/members/lucia-ferreira-3");
    fireEvent.click(stamp);
    expect(within(pass).getByRole("heading", { name: "Nothing torn out" })).toBeTruthy();
  });

  it("filters by neighborhood and by an accent-free search", () => {
    renderWithQueries(<Page />, seed);
    fireEvent.click(screen.getByRole("button", { name: "Woodside 1" }));
    expect(within(sheet()).getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "All 13" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search members" }), { target: { value: "lucia" } });
    expect(within(sheet()).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Lucía Ferreira, Owner, in Woodside"]);
  });
});
