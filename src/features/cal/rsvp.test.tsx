// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";
import { fake } from "@/test/fake-fns";
import { RsvpPanel } from "./rsvp";
import type { CalEvent } from "./types";

vi.mock("./fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/events/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const event: CalEvent = {
  uid: "evt1", slug: "supper", title: "Supper club", description: null, category: null, coverImageUrl: null, startTime: future(2), endTime: future(3),
  timeZone: "America/New_York", location: null, capacity: 10, status: "SCHEDULED", host: { name: "Host", username: "twc" },
  goingCount: 1, maybeCount: 0, spotsLeft: 9, attendees: [],
};
const posts: { url: string; body: Record<string, unknown> }[] = [];
let replies: (Response | Error)[] = [];
beforeEach(() => {
  posts.length = 0;
  replies = [];
  fake.reset();
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    posts.push({ url, body: JSON.parse(String(init.body)) });
    const next = replies.shift()!;
    if (next instanceof Error) throw next;
    return next;
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const saved = (status = "GOING", uid = "r1") => Response.json({ uid, status, plusOnes: 0 });
const refused = (status: number, code: string, error = "Refused") => Response.json({ error, code }, { status });
const fill = () => {
  fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: "Rosa" } });
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "rosa@x.test" } });
};
const send = () => fireEvent.click(screen.getByRole("button", { name: /Send my RSVP|Update my RSVP/ }));
const statusText = () => screen.getAllByRole("status").map((n) => n.textContent).join(" ");

describe("RsvpPanel", () => {
  it("shows field errors tied to their inputs, and sends nothing", async () => {
    renderWithQueries(<RsvpPanel event={event} />);
    send();
    const name = await screen.findByLabelText(/Your name/);
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(name.getAttribute("aria-describedby")!)?.textContent).toMatch(/add your name/);
    expect(screen.getByLabelText(/Email/).getAttribute("aria-invalid")).toBe("true");
    expect(statusText()).toMatch(/fix the highlighted/);
    expect(posts).toEqual([]);
  });

  it("confirms, announces it, and changes the RSVP with the stored uid", async () => {
    replies = [saved("GOING", "r1"), saved("MAYBE", "r1")];
    renderWithQueries(<RsvpPanel event={event} />);
    fill();
    send();
    expect(await screen.findByText("You’re going. See you there!", { selector: "p.font-display" })).toBeTruthy();
    expect(statusText()).toMatch(/You’re going/);
    expect(posts[0].url).toBe("/api/gatherings/evt1/rsvp");
    expect(posts[0].body.rsvpUid).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Change my RSVP" }));
    fireEvent.click(screen.getByRole("radio", { name: "Maybe" }));
    send();
    expect(await screen.findByText("You’re down as a maybe.", { selector: "p.font-display" })).toBeTruthy();
    expect(posts[1].body).toMatchObject({ rsvpUid: "r1", status: "MAYBE", email: "rosa@x.test" });
  });

  it("shows this device's RSVP again on return", async () => {
    window.localStorage.setItem("twc-rsvp-last:evt1", JSON.stringify({ email: "rosa@x.test", name: "Rosa", status: "MAYBE", plusOnes: 0 }));
    renderWithQueries(<RsvpPanel event={event} />);
    expect(await screen.findByText("You’re down as a maybe.", { selector: "p.font-display" })).toBeTruthy();
  });

  it("EVENT_FULL offers Maybe, which sends", async () => {
    replies = [refused(409, "EVENT_FULL", "This event is full."), saved("MAYBE")];
    renderWithQueries(<RsvpPanel event={event} />);
    fill();
    send();
    fireEvent.click(await screen.findByRole("button", { name: "Put me down as a maybe" }));
    expect(await screen.findByText("You’re down as a maybe.", { selector: "p.font-display" })).toBeTruthy();
    expect(posts[1].body).toMatchObject({ status: "MAYBE", plusOnes: 0 });
  });

  it("RSVP_EXISTS explains what to do", async () => {
    replies = [refused(409, "RSVP_EXISTS")];
    renderWithQueries(<RsvpPanel event={event} />);
    fill();
    send();
    expect(await screen.findByText(/already RSVP’d from another device/)).toBeTruthy();
  });

  it("RATE_LIMITED says so, with no retry button to hammer", async () => {
    replies = [refused(429, "RATE_LIMITED", "Too many tries. Please wait a moment and try again.")];
    renderWithQueries(<RsvpPanel event={event} />);
    fill();
    send();
    expect((await screen.findAllByText(/Too many tries/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("a network error keeps the form and retries", async () => {
    replies = [new TypeError("offline"), saved()];
    renderWithQueries(<RsvpPanel event={event} />);
    fill();
    send();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("You’re going. See you there!", { selector: "p.font-display" })).toBeTruthy();
    await waitFor(() => expect(posts).toHaveLength(2));
  });

  it("moves focus to the first field it marked, not the button", async () => {
    renderWithQueries(<RsvpPanel event={event} />);
    fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: "Rosa" } });
    send();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/Email/)));
  });

  it("after sending, focus follows the confirmation that replaced the form", async () => {
    replies = [saved("GOING")];
    renderWithQueries(<RsvpPanel event={event} />);
    fill();
    send();
    await screen.findByText("You’re going. See you there!", { selector: "p.font-display" });
    await waitFor(() => expect(document.activeElement?.textContent).toContain("You’re going. See you there!"));
  });

  it("tells a signed-out visitor that members answer in one tap, after logging in", () => {
    const { unmount } = renderWithQueries(<RsvpPanel event={event} signedIn={false} />);
    expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/auth");
    expect(screen.getByText(/to answer in one tap/)).toBeTruthy();
    unmount();
    // Signed in but not (yet) a member, or another business's event: no such promise.
    const again = renderWithQueries(<RsvpPanel event={event} signedIn />);
    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
    again.unmount();
    renderWithQueries(<RsvpPanel event={event} signedIn={false} business="other" />);
    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
  });

  it("offers no form on a cancelled or ended event", () => {
    const { unmount } = renderWithQueries(<RsvpPanel event={{ ...event, status: "CANCELLED" }} />);
    expect(screen.getByText("This event has been cancelled.")).toBeTruthy();
    expect(screen.queryByRole("form")).toBeNull();
    unmount();
    renderWithQueries(<RsvpPanel event={{ ...event, startTime: future(-3), endTime: future(-2) }} />);
    expect(screen.getByText("This event has ended.")).toBeTruthy();
  });
});

describe("a full event's waitlist (guests)", () => {
  const full: CalEvent = { ...event, goingCount: 10, spotsLeft: 0 };
  const joined = () => Response.json({ waitlisted: true });

  it("offers the waitlist next to Send, posts only name and email, and says so on return", async () => {
    replies = [joined()];
    const { unmount } = renderWithQueries(<RsvpPanel event={full} />);
    expect(screen.getByText(/This event is full\. Join the waitlist, or say maybe\./)).toBeTruthy();
    // Going can't be taken on a full event, so a new answer starts on Maybe.
    expect((screen.getByRole("radio", { name: "Maybe" }) as HTMLInputElement).checked).toBe(true);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Join the waitlist" }));
    expect(await screen.findByText("You’re on the waitlist.", { selector: "p.font-display" })).toBeTruthy();
    expect(posts[0]).toEqual({ url: "/api/gatherings/evt1/waitlist", body: { name: "Rosa", email: "rosa@x.test" } });
    // What happens next, as it does: a freed spot alerts the admins (alertOpenSpot), who add people first come first.
    expect(screen.getByText(/If a spot opens, the host hears right away/)).toBeTruthy();
    unmount();
    renderWithQueries(<RsvpPanel event={full} />);
    expect(await screen.findByText("You’re on the waitlist.", { selector: "p.font-display" })).toBeTruthy();
  });

  it("closes Going and makes the waitlist the main action, the RSVP the second, as on the member's panel", () => {
    renderWithQueries(<RsvpPanel event={full} />);
    expect((screen.getByRole("radio", { name: "Going" }) as HTMLInputElement).disabled).toBe(true);
    const waitlist = screen.getByRole("button", { name: "Join the waitlist" });
    const rsvp = screen.getByRole("button", { name: "Send my RSVP" });
    expect(waitlist.className).not.toContain("twc-btn--outline");
    expect(rsvp.className).toContain("twc-btn--outline");
    expect(waitlist.compareDocumentPosition(rsvp) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("someone already going can still keep Going on an event she filled", () => {
    window.localStorage.setItem("twc-rsvp-last:evt1", JSON.stringify({ email: "rosa@x.test", name: "Rosa", status: "GOING", plusOnes: 0 }));
    renderWithQueries(<RsvpPanel event={full} />);
    fireEvent.click(screen.getByRole("button", { name: "Change my RSVP" }));
    expect((screen.getByRole("radio", { name: "Going" }) as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Update my RSVP" }).className).not.toContain("twc-btn--outline");
  });

  it("asks for name and email before joining, and sends nothing", async () => {
    renderWithQueries(<RsvpPanel event={full} />);
    fireEvent.click(screen.getByRole("button", { name: "Join the waitlist" }));
    expect((await screen.findAllByText(/Add your name and email to join the waitlist/)).length).toBeGreaterThan(0);
    expect(posts).toEqual([]);
  });

  it("EVENT_FULL from Cal on an event that looked open offers the waitlist too", async () => {
    replies = [refused(409, "EVENT_FULL", "This event is full."), joined()];
    renderWithQueries(<RsvpPanel event={event} />);
    expect(screen.queryByRole("button", { name: "Join the waitlist" })).toBeNull();
    fill();
    send();
    const join = await screen.findByRole("button", { name: "Join the waitlist" });
    // The refusal offers the waitlist and a maybe, and Going closes, since the seat is gone.
    expect(screen.getByRole("button", { name: "Put me down as a maybe" })).toBeTruthy();
    expect((screen.getByRole("radio", { name: "Going" }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("radio", { name: "Maybe" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(join);
    expect(await screen.findByText("You’re on the waitlist.", { selector: "p.font-display" })).toBeTruthy();
  });
});

describe("a signed-in member", () => {
  // The seeded answer, and the same answer for every later read (her refetch after a tap); a write's result is unused.
  const mine = (status: string | null, waitlisted = false, plusOnes = 0) => {
    const data = { status, plusOnes, waitlisted };
    fake.results = Array.from({ length: 6 }, () => data);
    return [["rsvps", "event", "evt1"], data] as [unknown[], unknown];
  };

  it("sees her answer from the server, not a form, and changes it in one tap as herself", async () => {
    renderWithQueries(<RsvpPanel event={event} member />, [mine("GOING", false, 2)]);
    expect(screen.getByText("You’re going. See you there!", { selector: "p.font-display" })).toBeTruthy();
    expect(screen.getByText("Bringing 2")).toBeTruthy();
    expect(screen.queryByLabelText(/Email/)).toBeNull();
    expect(screen.getByRole("button", { name: "Going" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Maybe" }));
    await waitFor(() => expect(fake.calls).toContainEqual(["setRsvpFn", { eventId: "evt1", status: "MAYBE" }]));
    expect(posts).toEqual([]);
    await waitFor(() => expect(statusText()).toMatch(/down as a maybe/));
  });

  it("can't tap Going on a full event; joins and leaves the waitlist instead", async () => {
    const full: CalEvent = { ...event, spotsLeft: 0 };
    const { unmount } = renderWithQueries(<RsvpPanel event={full} member />, [mine(null)]);
    expect((screen.getByRole("button", { name: "Going" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Join the waitlist" }));
    await waitFor(() => expect(fake.calls).toContainEqual(["setMemberWaitlistFn", { eventId: "evt1", on: true }]));
    unmount();
    renderWithQueries(<RsvpPanel event={full} member />, [mine(null, true)]);
    expect(screen.getByText("You’re on the waitlist.", { selector: "p.font-display" })).toBeTruthy();
    expect(screen.getByText(/If a spot opens, the host hears right away/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Leave the waitlist" }));
    await waitFor(() => expect(fake.calls).toContainEqual(["setMemberWaitlistFn", { eventId: "evt1", on: false }]));
  });

  it("shows a refusal, such as a seat taken in the meantime", async () => {
    const seeded = mine(null);
    fake.results = [new Error("This event is full."), ...fake.results];
    renderWithQueries(<RsvpPanel event={event} member />, [seeded]);
    fireEvent.click(screen.getByRole("button", { name: "Going" }));
    expect((await screen.findByRole("alert")).textContent).toBe("This event is full.");
  });

  it("another business's event, or the check still running, never shows her the member path", () => {
    const { unmount } = renderWithQueries(<RsvpPanel event={event} member business="other" />, [mine("GOING")]);
    expect(screen.getByLabelText(/Email/)).toBeTruthy();
    unmount();
    renderWithQueries(<RsvpPanel event={event} member checking />, [mine("GOING")]);
    expect(screen.queryByLabelText(/Email/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Going" })).toBeNull();
  });
});
