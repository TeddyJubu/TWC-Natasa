// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { isNotFound } from "@tanstack/react-router";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";
import { fake } from "@/test/fake-fns";

vi.mock("@/features/member-links/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/app/api", async () => (await import("@/test/fake-fns")).fakeApi);
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route } from "@/routes/spotlight";

afterEach(() => {
  cleanup();
  fake.reset();
});

const TOKEN = "a".repeat(43);
const prefill = { firstName: "Rosa", values: { full_name: "Rosa Diaz", business: "Rosa’s", neighborhood: "Astoria" } };
type Loader = (ctx: { deps: { t?: string } }) => Promise<unknown>;
const load = (t?: string) => (Route.options.loader as unknown as Loader)({ deps: { t } });
const show = () => {
  vi.spyOn(Route, "useLoaderData").mockReturnValue({ token: TOKEN, prefill } as never);
  const Page = Route.options.component as React.ComponentType;
  return renderWithQueries(<Page />);
};
const answer = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("/spotlight", () => {
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
    expect(fake.calls).toEqual([["openSpotlightFn", { token: TOKEN }]]);
  });

  it("prefills her details, asks the story first, then sends the answers with the token", async () => {
    show();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expectNoSkippedHeadings();
    expect((screen.getByLabelText("Your name") as HTMLInputElement).value).toBe("Rosa Diaz");
    expect((screen.getByLabelText(/^Neighborhood/) as HTMLInputElement).value).toBe("Astoria");
    fireEvent.submit(screen.getByRole("button", { name: /Send my Spotlight answers/ }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Please answer: What inspired you/));
    answer(/What inspired you/, "Bread.");
    answer(/working on right now/, "A bakery.");
    answer(/most proud of/, "The starter.");
    answer(/might not know/, "I sing.");
    fireEvent.click(screen.getByLabelText("Yes"));
    fake.results = [undefined];
    fireEvent.submit(screen.getByRole("button", { name: /Send my Spotlight answers/ }).closest("form")!);
    await screen.findByText(/Your answers are with The Women’s Collective/);
    expect(fake.calls).toEqual([["/api/spotlight", expect.objectContaining({
      token: TOKEN, honeypot: "", full_name: "Rosa Diaz", q_what_inspired_you_to_start: "Bread.", q_coffee_with_interview_opt_in: "Yes",
    })]]);
  });
});
