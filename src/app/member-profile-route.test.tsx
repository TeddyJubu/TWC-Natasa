// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import type { MemberProfile } from "@/index";
import type { MemberPage } from "@/features/members/queries";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";

vi.mock("@/features/members/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { fake } from "@/test/fake-fns";
import { Route } from "@/routes/members_.$slug";

const Page = Route.options.component as React.ComponentType;
const loader = Route.options.loader as unknown as (opts: { params: { slug: string } }) => Promise<MemberPage>;
const head = Route.options.head as unknown as (opts: { loaderData?: MemberPage }) => { meta?: Record<string, string>[] };

afterEach(() => {
  cleanup();
  fake.reset();
  vi.restoreAllMocks();
});

const card = (name: string, catalogueNumber: number, extra: Partial<MemberProfile> = {}): MemberProfile => ({
  id: `catalogue-${catalogueNumber}`, name, role: "Founder", business: `${name} Co`, neighborhood: "Astoria", specialty: "Food",
  bio: "Bakes for the block.", lookingFor: "Café owners", image: "/media/public/12/avatar", imageAlt: `Portrait of ${name}`, catalogueNumber, ...extra,
});
const page = (extra: Partial<MemberPage> = {}): MemberPage =>
  ({ member: card("Rosa Diaz", 12), neighbors: [], isPublic: true, audience: "visitor", ...extra });
const show = (data: MemberPage) => {
  vi.spyOn(Route, "useLoaderData").mockReturnValue(data as never);
  return renderWithQueries(<Page />);
};
const thrown = async (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => e);

describe("/members/:slug loader", () => {
  it("404s when the server returns no page (private, unlisted, or unknown)", async () => {
    fake.results = [null];
    expect(isNotFound(await thrown(loader({ params: { slug: "rosa-diaz-12" } })))).toBe(true);
    expect(fake.calls).toEqual([["memberPageFn", { slug: "rosa-diaz-12" }]]);
  });

  it("redirects an old name part to the current slug", async () => {
    fake.results = [page()];
    const error = await thrown(loader({ params: { slug: "rosa-12" } }));
    expect(isRedirect(error)).toBe(true);
  });

  it("returns the page for its canonical slug", async () => {
    fake.results = [page()];
    expect((await loader({ params: { slug: "rosa-diaz-12" } })).member.name).toBe("Rosa Diaz");
  });
});

describe("/members/:slug head", () => {
  const robots = (data: MemberPage) => head({ loaderData: data }).meta?.find((m) => m.name === "robots");
  it("indexes public profiles and never a members-only page", () => {
    expect(robots(page())).toBeUndefined();
    expect(robots(page({ isPublic: false, audience: "member" }))?.content).toBe("noindex");
  });
});

describe("/members/:slug page", () => {
  it("renders a public profile with one h1 and ordered headings", () => {
    show(page());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Rosa Diaz");
    expect(screen.getByText("Bakes for the block.")).toBeTruthy();
    expect(screen.getByAltText("Portrait of Rosa Diaz")).toBeTruthy();
    expectNoSkippedHeadings(screen.getByRole("main"));
  });

  it("asks visitors to sign in for an intro", () => {
    show(page());
    expect(screen.getByRole("link", { name: /sign in to ask for an intro/i }).getAttribute("href")).toBe("/auth");
    expect(screen.queryByRole("link", { name: /ask for an introduction/i })).toBeNull();
  });

  it("offers approved members an introduction instead", () => {
    show(page({ audience: "member" }));
    expect(screen.getByRole("link", { name: /ask for an introduction/i }).getAttribute("href")).toBe("/contact");
    expect(screen.queryByRole("link", { name: /sign in to ask/i })).toBeNull();
  });

  it("tells pending members introductions open once they're welcomed in", () => {
    show(page({ audience: "pending" }));
    expect(screen.getByText(/introductions open once you’re welcomed in/i)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /intro/i })).toBeNull();
  });

  it("shows initials, never a stand-in photo, without a portrait", () => {
    show(page({ member: card("Rosa Diaz", 12, { image: undefined, imageAlt: undefined }) }));
    expect(screen.getByRole("main").querySelector("img")).toBeNull();
    expect(screen.getByText("RD")).toBeTruthy();
  });

  it("links neighbors to their own pages and the neighborhood", () => {
    show(page({ neighbors: [card("Lena Ortiz", 15)] }));
    const section = screen.getByRole("heading", { name: "More neighbors from Astoria" }).closest("section")!;
    expect(within(section).getByRole("link", { name: /lena ortiz/i }).getAttribute("href")).toBe("/members/lena-ortiz-15");
    expect(within(section).getByRole("link", { name: /see all of astoria/i }).getAttribute("href")).toBe("/neighborhoods/astoria");
  });

  it("only links a safe website", () => {
    show(page({ member: card("Rosa Diaz", 12, { website: "javascript:alert(1)" }) }));
    expect(screen.queryByRole("link", { name: /website/i })).toBeNull();
  });
});
