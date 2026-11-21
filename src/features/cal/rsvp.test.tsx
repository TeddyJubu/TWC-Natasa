// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";
import { RsvpPanel } from "./rsvp";
import type { CalEvent } from "./types";

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

  it("offers no form on a cancelled or ended event", () => {
    const { unmount } = renderWithQueries(<RsvpPanel event={{ ...event, status: "CANCELLED" }} />);
    expect(screen.getByText("This event has been cancelled.")).toBeTruthy();
    expect(screen.queryByRole("form")).toBeNull();
    unmount();
    renderWithQueries(<RsvpPanel event={{ ...event, startTime: future(-3), endTime: future(-2) }} />);
    expect(screen.getByText("This event has ended.")).toBeTruthy();
  });
});
