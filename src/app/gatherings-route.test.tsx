// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";

vi.mock("@/features/events/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { fake } from "@/test/fake-fns";
import { Route } from "@/routes/gatherings";

// No router here: each test seeds the query itself unless it sets the loader's data.
let loaderData: unknown;
beforeEach(() => {
  loaderData = undefined;
  vi.spyOn(Route, "useLoaderData").mockImplementation(() => loaderData as never);
});

const Page = Route.options.component as React.ComponentType;
afterEach(() => {
  cleanup();
  fake.reset();
});

const settle = () => act(() => new Promise((r) => setTimeout(r, 20)));
const event = (id: string, title: string, neighborhood: string, starts_at: string, kind = "gathering") =>
  ({ id, title, description: `${title} description`, location: `${title} venue`, neighborhood, starts_at, kind });
const EVENTS = [
  event("e1", "Waterfront Coffee Introductions", "Long Island City", "2026-11-14T15:00:00.000Z"),
  event("e2", "Founders Supper Club", "Jackson Heights", "2026-11-20T23:00:00.000Z", "supper"),
];
const viewer = (signedIn: boolean, member: boolean, admin = false) => [["viewer"], { signedIn, member, admin }] as [unknown[], unknown];
const asMember = (rsvps: string[] = []): [unknown[], unknown][] => [
  viewer(true, true), [["session"], { id: "u1", email: "u1@x.test", name: "Rosa" }], [["rsvps", "u1"], rsvps], [["public-events"], EVENTS],
];
const row = (title: string) => screen.getByRole("heading", { name: title }).closest("li")!;

describe("/gatherings", () => {
  it("is indexable, with its own title and description", () => {
    const meta = (Route.options.head as () => { meta: Record<string, string>[] })().meta;
    expect(meta).not.toContainEqual({ name: "robots", content: "noindex" });
    expect(meta.find((m) => m.name === "description")?.content).toMatch(/Queens/);
  });

  it("loads the public calendar in the loader, and undefined when that fails", async () => {
    const run = () => (Route.options.loader as (c: unknown) => Promise<unknown>)({ context: { queryClient: new QueryClient() } });
    fake.results = [EVENTS];
    expect(await run()).toEqual(EVENTS);
    expect(fake.calls).toEqual([["publicEventsFn", { from: expect.any(String) }]]);
    fake.results = [new Error("down")];
    expect(await run()).toBeUndefined();
  });

  it("renders the loader's gatherings before the viewer is known (server-rendered), with no seat buttons yet", () => {
    loaderData = EVENTS;
    fake.results = [new Promise(() => {})]; // the viewer never settles
    renderWithQueries(<Page />);
    expect(row("Founders Supper Club")).toBeTruthy();
    expect(screen.queryByText(/Loading gatherings/)).toBeNull();
    expect(screen.queryByRole("link", { name: /sign in to save a seat/i })).toBeNull();
  });

  it("lists upcoming gatherings with New York day and time, kind, neighborhood and place, under one h1", () => {
    renderWithQueries(<Page />, [viewer(false, false), [["public-events"], EVENTS]]);
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Show up locally."]);
    expectNoSkippedHeadings();
    const coffee = row("Waterfront Coffee Introductions");
    expect(coffee.textContent).toMatch(/Nov14/);
    expect(coffee.textContent).toMatch(/Sat · 10:00 AM/);
    expect(coffee.textContent).toMatch(/Gathering/);
    expect(coffee.textContent).toMatch(/Long Island City/);
    expect(coffee.textContent).toMatch(/Waterfront Coffee Introductions venue/);
    expect(row("Founders Supper Club").textContent).toMatch(/Supper/);
  });

  it("asks visitors to sign in, linking to /auth, and never loads RSVPs", async () => {
    renderWithQueries(<Page />, [viewer(false, false), [["public-events"], EVENTS]]);
    const link = within(row("Founders Supper Club")).getByRole("link", { name: /sign in to save a seat for founders supper club/i });
    expect(link.getAttribute("href")).toBe("/auth");
    await settle();
    expect(fake.calls).toEqual([]);
  });

  it("shows signed-in applicants a disabled 'Unlocks once you’re welcomed in'", async () => {
    renderWithQueries(<Page />, [viewer(true, false), [["public-events"], EVENTS]]);
    const button = within(row("Founders Supper Club")).getByRole("button", { name: /unlocks once you’re welcomed in/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.queryByRole("link", { name: /sign in to save a seat/i })).toBeNull();
    await settle();
    expect(fake.calls).toEqual([]);
  });

  it("lets approved members save a seat, and shows the ones already saved", async () => {
    renderWithQueries(<Page />, asMember(["e2"]));
    expect(within(row("Founders Supper Club")).getByRole("button", { name: /seat saved/i })).toBeTruthy();
    fake.results = [null, ["e1", "e2"]]; // the RSVP, then the rsvps refetch
    fireEvent.click(within(row("Waterfront Coffee Introductions")).getByRole("button", { name: /save my seat/i }));
    await waitFor(() => expect(fake.calls).toContainEqual(["setRsvpFn", { eventId: "e1", going: true }]));
    await waitFor(() => expect(within(row("Waterfront Coffee Introductions")).getByRole("button", { name: /seat saved/i })).toBeTruthy());
  });

  it("lets admins save seats like members", () => {
    renderWithQueries(<Page />, [viewer(true, false, true), ...asMember().slice(1)]);
    expect(within(row("Founders Supper Club")).getByRole("button", { name: /save my seat/i })).toBeTruthy();
  });

  it("un-saves a saved seat", async () => {
    renderWithQueries(<Page />, asMember(["e2"]));
    fake.results = [null, []];
    fireEvent.click(within(row("Founders Supper Club")).getByRole("button", { name: /seat saved/i }));
    await waitFor(() => expect(fake.calls).toContainEqual(["setRsvpFn", { eventId: "e2", going: false }]));
  });

  it("shows a failed RSVP as an alert", async () => {
    renderWithQueries(<Page />, asMember());
    fake.results = [new Error("Members only.")];
    fireEvent.click(within(row("Founders Supper Club")).getByRole("button", { name: /save my seat/i }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/members only/i);
  });

  it("filters by neighborhood", () => {
    renderWithQueries(<Page />, [viewer(false, false), [["public-events"], EVENTS]]);
    const group = screen.getByRole("group", { name: /browse by neighborhood/i });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["All", "Long Island City", "Jackson Heights"]);
    fireEvent.click(within(group).getByRole("button", { name: "Jackson Heights" }));
    expect(within(group).getByRole("button", { name: "Jackson Heights" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("heading", { name: "Waterfront Coffee Introductions" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Founders Supper Club" })).toBeTruthy();
  });

  it("says when nothing is on the calendar, with no filter", () => {
    renderWithQueries(<Page />, [viewer(false, false), [["public-events"], []]]);
    expect(screen.getByText("No gatherings on the calendar yet. We’ll post the next one here.")).toBeTruthy();
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("shows a load error with a Retry that refetches", async () => {
    fake.results = [new Error("offline")];
    renderWithQueries(<Page />, [viewer(false, false)]);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn’t load the calendar/i);
    fake.results = [EVENTS];
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Founders Supper Club" })).toBeTruthy();
    expect(fake.calls.map((c) => c[0])).toEqual(["publicEventsFn", "publicEventsFn"]);
  });

  it("has no past-gatherings photo band and invites members to pitch one", () => {
    renderWithQueries(<Page />, [viewer(false, false), [["public-events"], EVENTS]]);
    expect(screen.queryByRole("heading", { name: /recently/i })).toBeNull();
    expect(screen.getByRole("link", { name: /pitch a gathering/i }).getAttribute("href")).toBe("/contact");
  });
});
