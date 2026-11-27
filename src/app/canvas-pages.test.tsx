// @vitest-environment jsdom
// The design canvas's own pages (owner decision, 2026-11-26: no deliberate differences from the canvas; use real data):
// /constellations, /membership and /leadership, and the shared Arches and Bands. Members and leaders come only from the
// roster (rosterQuery); this public repo names no member.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";
import { INDEXED } from "@/app/seo";

vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route as Constellations } from "@/routes/constellations";
import { Route as Membership } from "@/routes/membership";
import { Route as Leadership } from "@/routes/leadership";

afterEach(cleanup);
type AnyRoute = { options: { component?: unknown } };
const viewer: [unknown[], unknown] = [["viewer"], { signedIn: false, member: false, admin: false }];
const EMPTY = { members: [], leads: {} };
const ROSTER = {
  leads: { WQ: "Wren Example" },
  members: [
    { name: "Ann Example", hood: "Greenpoint", constellation: "NB", photo: "/media/roster/ann.webp", role: "Florist", business: "Stems", founder: true },
    { name: "Cleo Sample", hood: "Williamsburg", constellation: "NB", photo: "/media/roster/cleo.webp", role: "Potter", business: "Kiln" },
    { name: "Bea Sample", hood: "Astoria", constellation: "WQ", photo: "/media/roster/bea.webp" },
  ],
};
const show = (route: AnyRoute, roster: unknown = EMPTY) => {
  const Page = route.options.component as React.ComponentType;
  return renderWithQueries(<Page />, [viewer, [["roster"], roster]]);
};
const main = () => screen.getByRole("main");

describe.each([["/constellations", Constellations], ["/membership", Membership], ["/leadership", Leadership]] as const)("%s", (path, route) => {
  it("is indexed, with one main, one h1 and no skipped headings", () => {
    expect(INDEXED.has(path)).toBe(true);
    show(route);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expectNoSkippedHeadings();
  });
});

describe("/constellations", () => {
  it("draws the five bands, and a band's cards are its roster members (the founder leads it, as on the canvas, with no card)", () => {
    show(Constellations, ROSTER);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Five Constellations");
    const bands = [...main().querySelectorAll("details.twc-cband")];
    expect(bands.map((b) => b.querySelector(".twc-cband__name")!.textContent)).toEqual(
      ["North Brooklyn", "Western Queens", "Brownstone Brooklyn", "Uptown Manhattan", "Downtown Manhattan"]);
    const nb = within(bands[0] as HTMLElement);
    expect(nb.getByAltText("Cleo Sample").getAttribute("src")).toBe("/media/roster/cleo.webp");
    expect(nb.getByText("Kiln")).toBeTruthy();
    expect(nb.queryByAltText("Ann Example")).toBeNull();
    expect(nb.getByRole("link", { name: /^Join North Brooklyn/ }).getAttribute("href")).toBe("/join");
    expect(within(bands[1] as HTMLElement).getByText(/Wren Example/)).toBeTruthy(); // "Led by", from roster.leads
  });

  it("with no roster draws open seats and names nobody", () => {
    show(Constellations);
    expect(main().querySelectorAll(".twc-pf-card.is-open")).toHaveLength(10);
    expect(main().querySelector(".twc-pf-card:not(.is-open)")).toBeNull();
    expect(main().querySelector("img[src^='/media/roster/']")).toBeNull();
  });
});

describe("/membership", () => {
  it("shows the canvas's four tiers, opens on Yearly, and Monthly switches the prices", () => {
    show(Membership);
    const amounts = () => [...main().querySelectorAll(".twc-arch__amt")].map((p) => p.textContent);
    expect(amounts()).toEqual(["$0", "$200", "$435", "$220"]);
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(screen.getByRole("button", { name: "Monthly" }).getAttribute("aria-pressed")).toBe("true");
    expect(amounts()).toEqual(["$0", "$20", "$40", "$220"]);
  });

  it("sends the paid tiers to plain /join and the free one to the letter's own signup", () => {
    show(Membership);
    for (const [name, href] of [["Get the newsletter", "/#letter"], ["Become a member", "/join"], ["Promote my business", "/join"], ["Apply", "/join"]]) {
      const a = within(main()).getByRole("link", { name });
      expect(a.getAttribute("href")).toBe(href);
      expect(a.className.split(" ")).toContain("twc-btn");
    }
  });

  it("promises the members-only directory, never Google, and only the saving it gives", () => {
    show(Membership);
    expect(main().textContent).not.toMatch(/Google/);
    expect(main().textContent).toMatch(/Your profile in the members-only directory/);
    expect(screen.getByRole("button", { name: "Yearly, save up to two months" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(main().textContent).toMatch(/\$220per year, yearly only/);
  });
});

describe("/leadership", () => {
  it("names leads only from the roster; every other seat is open", () => {
    show(Leadership, ROSTER);
    expect(screen.getByRole("heading", { level: 3, name: "Ann Example" })).toBeTruthy(); // the founder
    fireEvent.click(screen.getByRole("button", { name: "Western Queens" }));
    expect(screen.getByRole("heading", { level: 2, name: "Western Queens" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Wren Example" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 3, name: "Open seat" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Apply for this seat" })[0].getAttribute("href")).toBe("/contact");
  });

  it("with no roster names nobody", () => {
    show(Leadership);
    fireEvent.click(screen.getByRole("button", { name: "North Brooklyn" }));
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Open seat", "Open seat", "Open seat"]);
  });
});

// The canvas's invented people (its PEOPLE, PF_* fillers and roster) must never be drawn; the repo is public. Only the
// founder's own public name may appear, as North Brooklyn's lead.
it("no canvas page source carries a member's or a sample person's name", () => {
  const dir = "src/app/canvas";
  const sources = [...readdirSync(dir).map((f) => join(dir, f)), "src/routes/constellations.tsx", "src/routes/leadership.tsx", "src/routes/membership.tsx"]
    .map((f) => readFileSync(f, "utf8")).join("\n");
  expect(sources).not.toMatch(/Shauna|Tuso|Okafor|Lindqvist|Maya Ross|PF_FIRST|CHART_MEMBERS/);
});
