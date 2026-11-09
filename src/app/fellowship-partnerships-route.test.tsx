// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { INDEXED } from "@/app/seo";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";

const sendPartnership = vi.hoisted(() => vi.fn());
vi.mock("@/features/contact/partnership-mutation", () => ({ sendPartnership }));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route as Fellowship } from "@/routes/fellowship";
import { Route as Partnerships } from "@/routes/partnerships";

// The loader reads the page's editable wording; none saved means the defaults.
vi.spyOn(Partnerships, "useLoaderData").mockReturnValue({} as never);
afterEach(() => {
  cleanup();
  sendPartnership.mockReset();
});

type AnyRoute = { options: { component?: unknown; head?: unknown } };
type Head = { meta: Record<string, string>[] };
const head = (route: AnyRoute) => (route.options.head as () => Head)();
const show = (route: AnyRoute) => {
  const Page = route.options.component as React.ComponentType;
  return renderWithQueries(<Page />);
};
const main = () => screen.getByRole("main");
const href = (name: string | RegExp) => within(main()).getByRole("link", { name }).getAttribute("href");

describe.each([["/fellowship", Fellowship], ["/partnerships", Partnerships]] as const)("%s", (path, route) => {
  it("is indexable, in INDEXED, with a real title and description", () => {
    const { meta } = head(route);
    expect(INDEXED.has(path)).toBe(true);
    expect(meta).not.toContainEqual({ name: "robots", content: "noindex" });
    expect(meta.find((m) => m.name === "description")?.content).toBeTruthy();
    expect(meta.find((m) => m.property === "og:title")?.content).toBe(meta.find((m) => m.title)?.title);
  });

  it("has one main, one h1, no skipped headings and no [bracket] placeholders", () => {
    show(route);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(main().id).toBe("main");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expectNoSkippedHeadings();
    expect(main().textContent).not.toMatch(/[[\]]/);
  });

  it("is Western Queens only: no Brooklyn place names", () => {
    show(route);
    expect(document.body.textContent).not.toMatch(/Brooklyn|Greenpoint|Williamsburg|Bushwick/i);
  });
});

describe("/fellowship", () => {
  it("links to the application, the questions, the contact page and the code of conduct", () => {
    show(Fellowship);
    expect(href("Start your application")).toBe("/join");
    expect(href("Come to something first")).toBe("/gatherings");
    expect(href("Read the questions")).toBe("/faq");
    expect(href("Write to us")).toBe("/contact");
    expect(href("Read the code of conduct")).toBe("/code-of-conduct");
    expect(href("See how it works")).toBe("/about");
    expect(href("Who the collective is for")).toBe("/faq#membership");
  });

  it("states no eligibility rules, fees or review timelines the owner hasn't confirmed", () => {
    show(Fellowship);
    expect(main().textContent).not.toMatch(/you.ll fit here|probably isn.t for you|free to join|no dues|two weeks|fourteen days|six months/i);
  });
});

describe("/partnerships", () => {
  it("shows the four ways in and no current-partners block", () => {
    show(Partnerships);
    for (const way of ["Open your space", "Share what you know", "Feed the room", "Underwrite something"]) {
      expect(screen.getByRole("heading", { name: way })).toBeTruthy();
    }
    expect(main().textContent).not.toMatch(/in great company|who we work with/i);
    expect(href("Apply to join")).toBe("/join");
  });

  const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  const submit = () => fireEvent.click(screen.getByRole("button", { name: /send inquiry/i }));
  function fill() {
    type(/your name/i, "Rosa Diaz");
    type(/^email$/i, "rosa@x.test");
    type(/^business$/i, "Rosa’s Ceramics");
    fireEvent.click(screen.getByLabelText(/Teach/));
    type(/what did you have in mind/i, "A glazing workshop.");
  }

  it("names every missing field inline, focuses the first, and sends nothing", () => {
    show(Partnerships);
    submit();
    const name = screen.getByLabelText(/your name/i);
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(name.getAttribute("aria-describedby")!)?.textContent).toBe("Please tell us your name.");
    expect(screen.getByLabelText(/^business$/i).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText(/I’m happy for/).getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(name);
    expect(sendPartnership).not.toHaveBeenCalled();
  });

  it("requires consent before it sends", () => {
    show(Partnerships);
    fill();
    submit();
    expect(screen.getByLabelText(/I’m happy for/).getAttribute("aria-invalid")).toBe("true");
    expect(sendPartnership).not.toHaveBeenCalled();
  });

  it("sends the contract shape, then confirms with their email", async () => {
    sendPartnership.mockResolvedValue(undefined);
    show(Partnerships);
    fill();
    fireEvent.click(screen.getByLabelText(/I’m happy for/));
    submit();
    expect(await screen.findByRole("heading", { name: "Thanks for writing." })).toBeTruthy();
    expect(sendPartnership).toHaveBeenCalledWith({
      kind: "partnership", name: "Rosa Diaz", email: "rosa@x.test", business: "Rosa’s Ceramics",
      collaboration_type: "teach", message: "A glazing workshop.", consent: true, honeypot: "",
    });
    expect(screen.getByRole("status").textContent).toContain("We’ll be in touch at rosa@x.test.");
    expectNoSkippedHeadings();
  });

  it("keeps a hidden honeypot out of reach of people and passes a bot's value through", async () => {
    sendPartnership.mockResolvedValue(undefined);
    show(Partnerships);
    const trap = document.getElementById("p-honeypot")!;
    expect(trap.closest("[aria-hidden='true']")).not.toBeNull();
    expect(trap.getAttribute("tabindex")).toBe("-1");
    fill();
    fireEvent.click(screen.getByLabelText(/I’m happy for/));
    fireEvent.change(trap, { target: { value: "spam" } });
    submit();
    await waitFor(() => expect(sendPartnership).toHaveBeenCalled());
    expect(sendPartnership.mock.calls[0]![0].honeypot).toBe("spam");
  });

  it("keeps the form and shows the server's message when the inquiry couldn't be sent", async () => {
    sendPartnership.mockRejectedValue(new Error("Too many messages from here. Please try again later."));
    show(Partnerships);
    fill();
    fireEvent.click(screen.getByLabelText(/I’m happy for/));
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Your inquiry didn’t send.");
    expect(alert.textContent).toContain("Too many messages from here");
    await waitFor(() => expect((screen.getByRole("button", { name: /send inquiry/i }) as HTMLButtonElement).disabled).toBe(false));
    expect((screen.getByLabelText(/what did you have in mind/i) as HTMLTextAreaElement).value).toBe("A glazing workshop.");
  });
});

