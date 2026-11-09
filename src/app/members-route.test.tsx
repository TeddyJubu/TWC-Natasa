// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { MemberProfile } from "@/index";
import { demoMembers } from "@/showcase/demo-members";
import { NEIGHBORHOOD_SEED } from "@/features/neighborhoods/queries";
import { renderWithQueries, stubDialog } from "@/test/dom";

vi.mock("@/features/members/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));

import { fake } from "@/test/fake-fns";
import { Route } from "@/routes/members";

const Page = Route.options.component as React.ComponentType;
let restoreDialog: (() => void) | undefined;
afterEach(() => {
  cleanup();
  fake.reset();
  restoreDialog?.();
  restoreDialog = undefined;
});

// Query functions call their server function asynchronously, so let pending work settle first.
const settle = () => act(() => new Promise((r) => setTimeout(r, 20)));
const neverFetched = async (qc: { getQueryData: (k: unknown[]) => unknown }, key: string, fn: string) => {
  await settle();
  expect(qc.getQueryData([key])).toBeUndefined();
  expect(fake.calls).not.toContainEqual([fn]);
};

const card = (name: string, catalogueNumber: number, id = `u-${catalogueNumber}`): MemberProfile => ({
  id, name, role: "Founder", business: `${name} Co`, neighborhood: "Astoria", specialty: "Food",
  bio: "", lookingFor: "", image: "x.jpg", imageAlt: `Portrait of ${name}`, catalogueNumber,
});

const viewer = (signedIn: boolean, member: boolean, admin = false) => [["viewer"], { signedIn, member, admin }] as [unknown[], unknown];

describe("/members", () => {
  it("approved members see the full directory with real catalogue numbers", async () => {
    const { queryClient } = renderWithQueries(<Page />, [
      viewer(true, true),
      [["directory"], [card("Rosa Diaz", 12), card("Lena Ortiz", 15)]],
    ]);
    expect(screen.getByText("Rosa Diaz")).toBeTruthy();
    expect(screen.getByLabelText("Catalogue number 12")).toBeTruthy();
    expect(screen.getByLabelText("Catalogue number 15")).toBeTruthy();
    expect(screen.queryByText(/sign in to see the full directory/i)).toBeNull();
    await neverFetched(queryClient, "public-profiles", "publicProfilesFn");
  });

  it("admins see the full directory too, even without an approved profile", async () => {
    const { queryClient } = renderWithQueries(<Page />, [
      viewer(true, false, true),
      [["directory"], [card("Rosa Diaz", 12), card("Lena Ortiz", 15)]],
    ]);
    expect(screen.getByText("Rosa Diaz")).toBeTruthy();
    expect(screen.getByText("Lena Ortiz")).toBeTruthy();
    expect(screen.queryByText(/your directory unlocks/i)).toBeNull();
    expect(screen.queryByText(/sign in to see the full directory/i)).toBeNull();
    await neverFetched(queryClient, "public-profiles", "publicProfilesFn");
  });

  it("visitors see public profiles and a sign-in prompt, never the members-only directory", async () => {
    const { queryClient } = renderWithQueries(<Page />, [viewer(false, false), [["public-profiles"], [card("Pia Lund", 21, "public-21")]]]);
    expect(screen.getByText("Pia Lund")).toBeTruthy();
    expect(screen.getByLabelText("Catalogue number 21")).toBeTruthy();
    const prompt = screen.getByRole("link", { name: /sign in to see the full directory/i });
    expect(prompt.getAttribute("href")).toBe("/auth");
    await neverFetched(queryClient, "directory", "directoryFn");
  });

  it("pending members see public profiles and the welcome-in message, never the directory", async () => {
    const { queryClient } = renderWithQueries(<Page />, [viewer(true, false), [["public-profiles"], [card("Pia Lund", 21, "public-21")]]]);
    expect(screen.getByText("Pia Lund")).toBeTruthy();
    expect(screen.getByText(/your directory unlocks once you’re welcomed in/i)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /sign in to see the full directory/i })).toBeNull();
    await neverFetched(queryClient, "directory", "directoryFn");
  });

  it("shows a loading status, not an empty state, while the viewer is unknown", () => {
    fake.results = [new Promise(() => {})]; // the viewer never settles
    renderWithQueries(<Page />);
    expect(screen.getByRole("status").textContent).toMatch(/loading members/i);
    expect(screen.queryByText(/no one has shared/i)).toBeNull();
    expect(screen.queryByText(/profiles$/)).toBeNull();
  });

  it("surfaces a viewer error and retries the viewer", async () => {
    fake.results = [new Error("offline")];
    renderWithQueries(<Page />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn’t load/i);
    expect(fake.calls).toEqual([["viewerFn"]]); // the viewer, not another query, took the error
    const card = { id: "catalogue-21", name: "Pia Lund", role: "Founder", business: "Pia Co", neighborhood: "Astoria",
      specialty: "Food", bio: "", lookingFor: "", catalogueNumber: 21 };
    fake.results = [{ signedIn: false, member: false, admin: false }, [card]];
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(fake.calls).toEqual([["viewerFn"], ["viewerFn"], ["publicProfilesFn"]]));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("switches from public cards to the full directory when the viewer becomes a member", async () => {
    const { queryClient } = renderWithQueries(<Page />, [
      viewer(false, false),
      [["public-profiles"], [card("Pia Lund", 21, "public-21")]],
      [["directory"], [card("Pia Lund", 21), card("Rosa Diaz", 12)]],
    ]);
    expect(screen.queryByText("Rosa Diaz")).toBeNull();
    act(() => queryClient.setQueryData(["viewer"], { signedIn: true, member: true, admin: false }));
    expect(await screen.findByText("Rosa Diaz")).toBeTruthy();
    expect(screen.queryByText(/sign in to see the full directory/i)).toBeNull();
  });

  it("shows no demo members and no fictional-profiles banner", () => {
    renderWithQueries(<Page />, [viewer(false, false), [["public-profiles"], []]]);
    expect(screen.queryByText(/fictional/i)).toBeNull();
    for (const m of demoMembers) expect(screen.queryByText(m.name)).toBeNull();
  });

  it("each audience gets its own empty state", () => {
    renderWithQueries(<Page />, [viewer(false, false), [["public-profiles"], []]]);
    expect(screen.getByText(/no one has shared a public profile yet/i)).toBeTruthy();
    cleanup();
    renderWithQueries(<Page />, [viewer(true, true), [["directory"], []]]);
    expect(screen.getByText(/no members are listed yet/i)).toBeTruthy();
  });

  it("filters by active neighborhoods only, plus inactive ones a listed member still uses", () => {
    const hoods = NEIGHBORHOOD_SEED.map((n) => (n.slug === "rego-park" || n.slug === "sunnyside" ? { ...n, active: false } : n));
    renderWithQueries(<Page />, [
      [["neighborhoods"], hoods],
      viewer(true, true),
      [["directory"], [card("Rosa Diaz", 12), { ...card("Lena Ortiz", 15), neighborhood: "Sunnyside" }]],
    ]);
    const chips = within(screen.getByRole("group", { name: /browse by neighborhood/i })).getAllByRole("radio").map((r) => r.closest("label")?.textContent);
    expect(chips).toContain("Astoria");
    expect(chips).toContain("Sunnyside");
    expect(chips).not.toContain("Rego Park");
  });

  it("offers no chip for members without a neighborhood", () => {
    renderWithQueries(<Page />, [
      viewer(true, true),
      [["directory"], [card("Rosa Diaz", 12), { ...card("Lena Ortiz", 15), neighborhood: "" }]],
    ]);
    const chips = within(screen.getByRole("group", { name: /browse by neighborhood/i })).getAllByRole("radio").map((r) => r.closest("label")?.textContent);
    expect(chips).not.toContain("");
    expect(chips.filter((c) => c === "Astoria")).toHaveLength(1);
    expect(screen.getByText("Lena Ortiz")).toBeTruthy();
  });

  it("shows initials, never a stand-in photo, for a member without a portrait", () => {
    renderWithQueries(<Page />, [
      viewer(true, true),
      [["directory"], [{ ...card("Rosa Diaz", 12), image: undefined, imageAlt: undefined }]],
    ]);
    const main = screen.getByRole("main");
    expect(main.querySelector("img[src*='hero']")).toBeNull();
    expect(screen.queryByAltText(/portrait of/i)).toBeNull();
    expect(screen.getByText("RD")).toBeTruthy();
  });

  it("filters the cards by the chosen neighborhood", () => {
    renderWithQueries(<Page />, [
      viewer(true, true),
      [["directory"], [card("Rosa Diaz", 12), { ...card("Lena Ortiz", 15), neighborhood: "Sunnyside" }]],
    ]);
    fireEvent.click(screen.getByRole("radio", { name: "Sunnyside" }));
    expect(screen.queryByText("Rosa Diaz")).toBeNull();
    expect(screen.getByText("Lena Ortiz")).toBeTruthy();
    expect(screen.getByText("01 profiles")).toBeTruthy();
  });

  it("counts the profiles shown", () => {
    renderWithQueries(<Page />, [viewer(true, true), [["directory"], [card("Rosa Diaz", 12), card("Lena Ortiz", 15)]]]);
    expect(within(document.body).getByText("02 profiles")).toBeTruthy();
  });

  it.each([
    ["approved members", viewer(true, true), "directory"],
    ["visitors", viewer(false, false), "public-profiles"],
  ] as const)("%s open a card into a dialog with that member's bio", (_who, v, key) => {
    restoreDialog = stubDialog();
    renderWithQueries(<Page />, [v, [[key], [{ ...card("Rosa Diaz", 12), bio: "Rosa bakes for the block." }, card("Lena Ortiz", 15)]]]);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View Rosa Diaz’s profile" }));
    const dialog = screen.getByRole("dialog", { name: "Rosa Diaz, member profile" });
    expect(within(dialog).getByText("Rosa bakes for the block.")).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: /open full page/i }).getAttribute("href")).toBe("/members/rosa-diaz-12");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
