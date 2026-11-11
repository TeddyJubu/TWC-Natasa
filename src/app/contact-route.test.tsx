// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";
import { expectNoSkippedHeadings } from "@/test/headings";

const sendContact = vi.hoisted(() => vi.fn());
vi.mock("@/features/contact/mutations", () => ({ sendContact }));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { Route } from "@/routes/contact";

const Page = Route.options.component as React.ComponentType;
// The loader reads the page's editable wording; none saved means the defaults.
vi.spyOn(Route, "useLoaderData").mockReturnValue({} as never);
afterEach(() => {
  cleanup();
  sendContact.mockReset();
});

const meta = () => (Route.options.head as unknown as () => { meta: Record<string, string>[] })().meta;
const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: /send message/i }));
function fill() {
  type(/your name/i, "Rosa Diaz");
  type(/^email$/i, "rosa@x.test");
  fireEvent.click(screen.getByLabelText("Press"));
  type(/message/i, "Hello from Astoria.");
  fireEvent.click(screen.getByRole("checkbox", { name: /hold these details/i }));
}

describe("/contact", () => {
  it("is indexable, with its own title and description", () => {
    expect(meta()).toContainEqual({ title: "Contact — The Women’s Collective" });
    expect(meta().find((m) => m.name === "description")?.content).toBeTruthy();
    expect(meta().find((m) => m.name === "robots")).toBeUndefined();
  });

  it("has one main and h1, the FAQ link, and no skipped headings", () => {
    renderWithQueries(<Page />);
    expect(screen.getByRole("main").id).toBe("main");
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Say hello, neighbor."]);
    expect(screen.getByRole("link", { name: "questions page" }).getAttribute("href")).toBe("/faq");
    expectNoSkippedHeadings();
  });

  it("shows inline errors tied to their fields, focuses the first, and sends nothing", () => {
    renderWithQueries(<Page />);
    type(/^email$/i, "not-an-email");
    submit();
    const name = screen.getByLabelText(/your name/i);
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(name.getAttribute("aria-describedby")!)?.textContent).toBe("Please tell us your name.");
    expect(screen.getByLabelText(/^email$/i).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText(/message/i).getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(name);
    expect(sendContact).not.toHaveBeenCalled();
  });

  it("needs the consent box, and offers the three newer topics", () => {
    renderWithQueries(<Page />);
    for (const t of ["Nominating someone for Member Monday", "Accessibility", "Reporting conduct"]) expect(screen.getByLabelText(t)).toBeTruthy();
    type(/your name/i, "Rosa Diaz");
    type(/^email$/i, "rosa@x.test");
    type(/message/i, "Hello.");
    submit();
    const box = screen.getByRole("checkbox", { name: /hold these details/i });
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(box.getAttribute("aria-describedby")!)?.textContent).toBe("Please tick the box so we can hold your details to reply.");
    expect(document.activeElement).toBe(box);
    expect(sendContact).not.toHaveBeenCalled();
  });

  it("keeps the honeypot out of the tab order and the accessibility tree", () => {
    renderWithQueries(<Page />);
    const trap = document.querySelector<HTMLInputElement>('input[name="honeypot"]')!;
    expect([trap.tabIndex, trap.closest("[aria-hidden]") !== null]).toEqual([-1, true]);
  });

  it("sends the message, then replaces the form with a confirmation naming their email", async () => {
    sendContact.mockResolvedValue(undefined);
    renderWithQueries(<Page />);
    fill();
    submit();
    expect(await screen.findByRole("heading", { name: "Thanks for reaching out." })).toBeTruthy();
    expect(sendContact).toHaveBeenCalledWith({
      name: "Rosa Diaz", email: "rosa@x.test", topic: "Press", message: "Hello from Astoria.", consent: true, honeypot: "",
    });
    expect(screen.getByRole("status").textContent).toContain("We’ll be in touch at rosa@x.test.");
    expect(screen.queryByRole("form", { name: "Contact form" })).toBeNull();
    expectNoSkippedHeadings();
  });

  it("keeps the form and says so when the message couldn't be sent", async () => {
    sendContact.mockRejectedValue(new Error("We couldn’t send your message just now. Please try again in a little while."));
    renderWithQueries(<Page />);
    fill();
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Your message didn’t send.");
    expect(alert.textContent).toContain("Please try again in a little while.");
    await waitFor(() => expect((screen.getByRole("button", { name: /send message/i }) as HTMLButtonElement).disabled).toBe(false));
    expect((screen.getByLabelText(/message/i) as HTMLTextAreaElement).value).toBe("Hello from Astoria.");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
