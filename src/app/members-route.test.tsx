// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { MemberProfile } from "@/index";
import { demoMembers } from "@/showcase/demo-members";
import { renderWithQueries } from "@/test/dom";
import { fake } from "@/test/fake-supabase";

vi.mock("@/app/supabase", async () => (await import("@/test/fake-supabase")).fakeSupabaseModule);
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route } from "@/routes/members";

const Page = Route.options.component as React.ComponentType;
afterEach(() => {
  cleanup();
  fake.reset();
});

// Query functions await getSupabase() before calling the rpc, so let pending work settle first.
const settle = () => act(() => new Promise((r) => setTimeout(r, 20)));
const neverFetched = async (qc: { getQueryData: (k: unknown[]) => unknown }, key: string, rpc: string) => {
  await settle();
  expect(qc.getQueryData([key])).toBeUndefined();
  expect(fake.calls).not.toContainEqual(["rpc", rpc]);
};

const card = (name: string, catalogueNumber: number, id = `u-${catalogueNumber}`): MemberProfile => ({
  id, name, role: "Founder", business: `${name} Co`, neighborhood: "Astoria", specialty: "Food",
  bio: "", lookingFor: "", image: "x.jpg", imageAlt: `Portrait of ${name}`, catalogueNumber,
});

const viewer = (signedIn: boolean, member: boolean) => [["viewer"], { signedIn, member }] as [unknown[], unknown];

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
    await neverFetched(queryClient, "public-profiles", "public_profiles");
  });

  it("visitors see public profiles and a sign-in prompt, never the members-only directory", async () => {
    const { queryClient } = renderWithQueries(<Page />, [viewer(false, false), [["public-profiles"], [card("Pia Lund", 21, "public-21")]]]);
    expect(screen.getByText("Pia Lund")).toBeTruthy();
    expect(screen.getByLabelText("Catalogue number 21")).toBeTruthy();
    const prompt = screen.getByRole("link", { name: /sign in to see the full directory/i });
    expect(prompt.getAttribute("href")).toBe("/auth");
    await neverFetched(queryClient, "directory", "public_directory");
  });

  it("pending members see public profiles and the welcome-in message, never the directory", async () => {
    const { queryClient } = renderWithQueries(<Page />, [viewer(true, false), [["public-profiles"], [card("Pia Lund", 21, "public-21")]]]);
    expect(screen.getByText("Pia Lund")).toBeTruthy();
    expect(screen.getByText(/your directory unlocks once you’re welcomed in/i)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /sign in to see the full directory/i })).toBeNull();
    await neverFetched(queryClient, "directory", "public_directory");
  });

  it("shows a loading status, not an empty state, while the viewer is unknown", () => {
    fake.results = [new Promise(() => {}) as never]; // getSession never settles
    renderWithQueries(<Page />);
    expect(screen.getByRole("status").textContent).toMatch(/loading members/i);
    expect(screen.queryByText(/no one has shared/i)).toBeNull();
    expect(screen.queryByText(/profiles$/)).toBeNull();
  });

  it("surfaces a viewer error and retries the viewer", async () => {
    fake.results = [{ data: { session: null }, error: { message: "offline" } }];
    renderWithQueries(<Page />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn’t load/i);
    fake.results = [{ data: { session: null }, error: null }, { data: [card("Pia Lund", 21)], error: null }];
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(fake.calls.filter((c) => c[0] === "getSession")).toHaveLength(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("switches from public cards to the full directory when the viewer becomes a member", async () => {
    const { queryClient } = renderWithQueries(<Page />, [
      viewer(false, false),
      [["public-profiles"], [card("Pia Lund", 21, "public-21")]],
      [["directory"], [card("Pia Lund", 21), card("Rosa Diaz", 12)]],
    ]);
    expect(screen.queryByText("Rosa Diaz")).toBeNull();
    act(() => queryClient.setQueryData(["viewer"], { signedIn: true, member: true }));
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

  it("counts the profiles shown", () => {
    renderWithQueries(<Page />, [viewer(true, true), [["directory"], [card("Rosa Diaz", 12), card("Lena Ortiz", 15)]]]);
    expect(within(document.body).getByText("02 profiles")).toBeTruthy();
  });
});
