// @vitest-environment jsdom
// The newsletter sign-up form: inline errors, the explicit tick, the honeypot, and its live success and error states.
// `send` is a stub, so no server module is imported and nothing is posted.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NewsletterSignup } from "./NewsletterSignup";
import { SIGNUP_ERRORS } from "./schema";

afterEach(cleanup);

const type = (value: string) => fireEvent.change(screen.getByLabelText("Email"), { target: { value } });
const tick = () => fireEvent.click(screen.getByRole("checkbox", { name: /send me the collective letter/i }));
const submit = () => fireEvent.click(screen.getByRole("button", { name: /sign me up/i }));

describe("NewsletterSignup", () => {
  it("renders an email field, an honest unticked consent box, a hidden honeypot and the id and class it is given", () => {
    const { container } = render(<NewsletterSignup id="letter" className="card" send={vi.fn()} />);
    const root = container.firstElementChild!;
    expect([root.id, root.className]).toEqual(["letter", "card"]);
    expect(screen.getByLabelText("Email").getAttribute("type")).toBe("email");
    const consent = screen.getByRole("checkbox", { name: "Send me the Collective letter. One email a week; unsubscribe any time." }) as HTMLInputElement;
    expect(consent.checked).toBe(false);
    const honeypot = container.querySelector<HTMLInputElement>('input[name="honeypot"]')!;
    expect(honeypot.tabIndex).toBe(-1);
    expect(honeypot.closest("[aria-hidden]")).not.toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("shows inline errors and sends nothing until the address is valid and the box is ticked", () => {
    const send = vi.fn();
    render(<NewsletterSignup send={send} />);
    submit();
    expect(screen.getByText(SIGNUP_ERRORS.email)).toBeTruthy();
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
    type("rosa@x.test");
    submit();
    expect(screen.queryByText(SIGNUP_ERRORS.email)).toBeNull();
    expect(screen.getByText(SIGNUP_ERRORS.consent)).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  });

  it("sends the trimmed address, consent true and the empty honeypot, then thanks her without saying whether she was new", async () => {
    const send = vi.fn(async () => {});
    render(<NewsletterSignup send={send} />);
    type(" rosa@x.test ");
    tick();
    submit();
    expect(send).toHaveBeenCalledWith({ email: "rosa@x.test", consent: true, honeypot: "" });
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("rosa@x.test"));
    expect(screen.getByRole("status").textContent).toContain("isn’t on the list yet");
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("keeps the form and shows the server's message in an alert when the sign-up fails", async () => {
    const send = vi.fn(async () => { throw new Error("We couldn’t add you just now. Please try again in a little while."); });
    render(<NewsletterSignup send={send} />);
    type("rosa@x.test");
    tick();
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("We couldn’t add you just now.");
    expect(screen.getByRole("button", { name: /sign me up/i })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("");
  });
});
