// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { isNotFound } from "@tanstack/react-router";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";
import { fake } from "@/test/fake-fns";

vi.mock("@/features/member-links/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/forms-state/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/app/api", async () => (await import("@/test/fake-fns")).fakeApi);
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route } from "@/routes/review";

afterEach(() => {
  cleanup();
  fake.reset();
});

const TOKEN = "a".repeat(43);
const prefill = { firstName: "Rosa", values: {
  full_name: "Rosa Diaz", email: "rosa@x.test", business_practice: "Rosa’s", profession_role: "", website_social: "", neighborhood_city: "Astoria", interests: "",
} };
type Loader = (ctx: { deps: { t?: string } }) => Promise<unknown>;
const load = (t?: string) => (Route.options.loader as unknown as Loader)({ deps: { t } });
const show = (closed: string | null = null) => {
  vi.spyOn(Route, "useLoaderData").mockReturnValue({ token: TOKEN, prefill, closed } as never);
  const Page = Route.options.component as React.ComponentType;
  return renderWithQueries(<Page />);
};

describe("/review", () => {
  it("is noindex and never sends its URL (with the token) as a referrer", () => {
    const { meta } = (Route.options.head as () => { meta: Record<string, string>[] })();
    expect(meta).toContainEqual({ name: "robots", content: "noindex" });
    expect(meta).toContainEqual({ name: "referrer", content: "no-referrer" });
  });

  it("is a 404 without a token, or when the server says the token doesn't open the form", async () => {
    expect(isNotFound(await load().catch((e: unknown) => e))).toBe(true);
    expect(fake.calls).toEqual([]);
    fake.results = [null];
    expect(isNotFound(await load(TOKEN).catch((e: unknown) => e))).toBe(true);
    expect(fake.calls).toEqual([["openReviewFn", { token: TOKEN }]]);
  });

  it("keeps a valid link on 200 with closed words when reviews are paused", async () => {
    fake.results = [prefill, { kind: "review", open: false, closed: "Reviews paused." }];
    await expect(load(TOKEN)).resolves.toEqual({ token: TOKEN, prefill, closed: "Reviews paused." });
    show("Reviews paused.");
    expect(screen.getByRole("heading", { name: "Member reviews are paused" })).toBeTruthy();
    expect(screen.getByText("Reviews paused.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Submit my review/ })).toBeNull();
  });

  it("greets her by first name with her details prefilled, and nothing preselected", () => {
    show();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expectNoSkippedHeadings();
    expect(screen.getByText(/Hello Rosa/)).toBeTruthy();
    expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("Rosa Diaz");
    expect((screen.getByLabelText(/Broad neighborhood/) as HTMLInputElement).value).toBe("Astoria");
    expect([...document.querySelectorAll<HTMLInputElement>("input[type=radio]")].some((r) => r.checked)).toBe(false);
  });

  it("asks for public fields only for a public listing, then sends the review with the token", async () => {
    show();
    fireEvent.click(screen.getByLabelText("Yes, keep me connected to the free community of The Women’s Collective."));
    expect(screen.queryByRole("group", { name: /which fields may appear/ })).toBeNull();
    fireEvent.click(screen.getByLabelText("Public listing."));
    fireEvent.click(screen.getByLabelText("Instagram"));
    fireEvent.click(screen.getByLabelText("Information correction"));
    fake.results = [undefined];
    fireEvent.submit(screen.getByRole("button", { name: /Submit my review/ }).closest("form")!);
    await screen.findByText("Thank you — your response is saved.");
    expect(fake.calls).toEqual([["/api/review", expect.objectContaining({
      token: TOKEN, honeypot: "", full_name: "Rosa Diaz", membership: "keep", directory: "public", public_fields: ["public_instagram"],
      correction_requests: ["req_info_correction"],
    })]]);
  });

  it("shows the server's answer when the link is no longer valid", async () => {
    show();
    fireEvent.click(screen.getByLabelText("I am not sure; please contact me."));
    fake.results = [new Error("This link isn’t valid: it may have expired or already been used.")];
    fireEvent.submit(screen.getByRole("button", { name: /Submit my review/ }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/isn’t valid/));
  });
});
