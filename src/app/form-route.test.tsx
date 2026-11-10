// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";
import { fake } from "@/test/fake-fns";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@/features/forms/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/app/api", async () => (await import("@/test/fake-fns")).fakeApi);
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs, useNavigate: () => navigate }));

import { Route } from "@/routes/f.$slug";
import { Route as Thanks } from "@/routes/f.$slug_.thanks";
import { DEMO_FORMS } from "@/features/forms/fixtures";
import type { PublicForm } from "@/features/forms/queries";
import type { Question } from "@/features/forms/schema";

afterEach(() => {
  cleanup();
  fake.reset();
  navigate.mockReset();
});

const rsvp: PublicForm = {
  slug: "salon-rsvp", name: "Salon RSVP (demo)", intro: "Made-up form for tests.\n\nTell us if you’re coming.", thanks: "Thank you — we’ve got your RSVP.",
  closed: null, questions: DEMO_FORMS[0]!.questions as Question[], moved: false,
};
type Loader = (ctx: { params: { slug: string } }) => Promise<unknown>;
const load = (route: { options: { loader?: unknown } }, slug: string) => (route.options.loader as Loader)({ params: { slug } }).catch((e: unknown) => e);
const show = (form: PublicForm) => {
  vi.spyOn(Route, "useLoaderData").mockReturnValue(form as never);
  const Page = Route.options.component as React.ComponentType;
  return renderWithQueries(<Page />);
};

describe("/f/$slug", () => {
  it("is a 404 for a name no form has, and 301s an old name to the current one", async () => {
    fake.results = [null];
    expect(isNotFound(await load(Route, "nope"))).toBe(true);
    fake.results = [{ ...rsvp, moved: true }];
    const moved = await load(Route, "salon-rsvp-old");
    expect(isRedirect(moved) && moved.options).toMatchObject({ to: "/f/$slug", params: { slug: "salon-rsvp" }, statusCode: 301 });
    fake.results = [{ ...rsvp, moved: true }];
    const thanks = await load(Thanks, "salon-rsvp-old");
    expect(isRedirect(thanks) && thanks.options).toMatchObject({ to: "/f/$slug/thanks", params: { slug: "salon-rsvp" } });
    expect(fake.calls).toEqual([["openFormFn", { slug: "nope" }], ["openFormFn", { slug: "salon-rsvp-old" }], ["openFormFn", { slug: "salon-rsvp-old" }]]);
  });

  it("is noindex, titled with the form's name, and loads the doop design sync", () => {
    const { meta, scripts } = (Route.options.head as (c: { loaderData: PublicForm }) => {
      meta: Record<string, string>[];
      scripts: { async: boolean; src: string }[];
    })({ loaderData: rsvp });
    expect(meta).toEqual([{ title: "Salon RSVP (demo) — The Women’s Collective" }, { name: "robots", content: "noindex" }]);
    expect(scripts).toEqual([{ async: true, src: "https://doop.design/doop-sync.js?key=dk_43wWjXdIlAXKScXwf9wqhCzb" }]);
  });

  it("shows a closed form's words and no questions", () => {
    show({ ...rsvp, closed: "This survey has closed.\n\nThank you to everyone.", questions: [] });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Salon RSVP (demo)");
    expect(screen.getByText("This survey has closed.")).toBeTruthy();
    expect(screen.getByText("Thank you to everyone.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Send/ })).toBeNull();
  });

  it("labels every question, then sends only the answers and moves on to the thank-you page", async () => {
    show(rsvp);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expectNoSkippedHeadings();
    expect(screen.getByText("Tell us if you’re coming.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: " Rosa Diaz " } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Rosa@X.test" } });
    fireEvent.click(screen.getByLabelText("Maybe"));
    fireEvent.click(screen.getByLabelText("Vegan"));
    fireEvent.click(screen.getByLabelText("No nuts"));
    fake.results = [undefined];
    fireEvent.submit(screen.getByRole("button", { name: /Send/ }).closest("form")!);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/f/$slug/thanks", params: { slug: "salon-rsvp" } }));
    expect(fake.calls).toEqual([["/api/forms/salon-rsvp", {
      answers: { name: "Rosa Diaz", email: "Rosa@X.test", coming: "maybe", diet: ["vegan", "no-nuts"] }, honeypot: "",
    }]]);
  });

  it("shows the server's refusal and stays on the form", async () => {
    show(rsvp);
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Rosa" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "rosa@x.test" } });
    fireEvent.click(screen.getByLabelText("Maybe"));
    fake.results = [new Error("We already have an answer from this email address for this form.")];
    fireEvent.submit(screen.getByRole("button", { name: /Send/ }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/already have an answer/));
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("/f/$slug/thanks", () => {
  it("shows the form's own thank-you words", () => {
    vi.spyOn(Thanks, "useLoaderData").mockReturnValue({ name: rsvp.name, thanks: "Thank you — we’ve got your RSVP.\n\nA person reads every answer." } as never);
    const Page = Thanks.options.component as React.ComponentType;
    renderWithQueries(<Page />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Salon RSVP (demo)");
    expect(screen.getByText("Thank you — we’ve got your RSVP.")).toBeTruthy();
    expect(screen.getByText("A person reads every answer.")).toBeTruthy();
  });
});
