// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";

vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));

import { MonthCalendar } from "./calendar";
import { kindClass } from "./event-state";
import type { CalEvent } from "./types";

afterEach(cleanup);
const event = (uid: string, startTime: string, timeZone: string, title = uid): CalEvent => ({
  uid, slug: uid, title, description: null, category: null, coverImageUrl: null, startTime,
  endTime: new Date(Date.parse(startTime) + 3_600_000).toISOString(), timeZone, location: null, capacity: null, status: "SCHEDULED",
  host: { name: null, username: null }, goingCount: 0, maybeCount: 0, spotsLeft: null, attendees: [],
});
const cell = (day: string) => document.querySelector<HTMLElement>(`[data-day="${day}"]`)!;

function Harness({ events, locale = "en-US", start = "2026-12" }: { events: CalEvent[]; locale?: string; start?: string }) {
  const [month, setMonth] = React.useState(start);
  return <MonthCalendar month={month} events={events} locale={locale} onMonthChange={setMonth} />;
}

describe("MonthCalendar", () => {
  it("puts an event on its own local day, whatever the instant's UTC date", () => {
    // The same instant: still Nov 30 in New York, already Dec 1 in Tokyo.
    const instant = "2026-12-01T03:00:00.000Z";
    renderWithQueries(<Harness events={[event("ny", instant, "America/New_York"), event("tokyo", instant, "Asia/Tokyo")]} />);
    expect(within(cell("2026-11-30")).getByRole("link", { name: /ny/ })).toBeTruthy();
    expect(within(cell("2026-12-01")).getByRole("link", { name: /tokyo/ })).toBeTruthy();
    expect(within(cell("2026-12-01")).queryByRole("link", { name: /ny/ })).toBeNull();
  });

  it("ticks the events she is going to, in words for screen readers too", () => {
    const at = "2026-12-05T23:00:00.000Z";
    renderWithQueries(<MonthCalendar month="2026-12" events={[event("mine", at, "UTC"), event("other", at, "UTC")]} onMonthChange={() => {}} locale="en-US" going={new Set(["mine"])} />);
    const links = within(cell("2026-12-05")).getAllByRole("link");
    expect(links.find((l) => /mine/.test(l.textContent ?? ""))?.textContent).toContain("You’re going");
    expect(links.find((l) => /other/.test(l.textContent ?? ""))?.textContent).not.toContain("going");
  });

  it("shows the time in the event's zone", () => {
    renderWithQueries(<Harness events={[event("ny", "2026-12-05T23:00:00.000Z", "America/New_York")]} />);
    expect(within(cell("2026-12-05")).getByRole("link").textContent).toContain("6:00");
  });

  it.each([["en-US", "Sunday"], ["en-GB", "Monday"]])("starts the week on %s's first day", (locale, first) => {
    renderWithQueries(<Harness events={[]} locale={locale} />);
    expect(screen.getAllByRole("columnheader")[0].getAttribute("abbr")).toBe(first);
  });

  it("collapses a busy day into +N more, which opens the whole day", () => {
    const at = (h: number) => `2026-12-10T${h}:00:00.000Z`;
    renderWithQueries(<Harness events={[15, 16, 17, 18].map((h) => event(`e${h}`, at(h), "UTC"))} />);
    const day = cell("2026-12-10");
    expect(within(day).getAllByRole("link")).toHaveLength(2);
    fireEvent.click(within(day).getByRole("button", { name: /\+2 more/ }));
    const panel = screen.getByRole("region", { name: /December 10/ });
    expect(within(panel).getAllByRole("link")).toHaveLength(4);
    expect(document.activeElement?.id).toBe("calendar-day");
  });

  it("moves prev, next and back to Today", () => {
    renderWithQueries(<Harness events={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("grid", { name: "January 2027" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("grid", { name: "November 2026" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    const now = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date());
    expect(screen.getByRole("grid", { name: now })).toBeTruthy();
  });

  it("has one tab stop and full keyboard movement, across months", () => {
    renderWithQueries(<Harness events={[]} />);
    expect(document.querySelectorAll('[role="gridcell"][tabindex="0"]')).toHaveLength(1);
    const start = cell("2026-12-01");
    start.focus();
    const press = (key: string) => fireEvent.keyDown(document.activeElement!, { key });
    press("ArrowRight");
    expect(document.activeElement).toBe(cell("2026-12-02"));
    press("ArrowDown");
    expect(document.activeElement).toBe(cell("2026-12-09"));
    press("Home"); // Sunday in en-US
    expect(document.activeElement).toBe(cell("2026-12-06"));
    press("End");
    expect(document.activeElement).toBe(cell("2026-12-12"));
    press("PageDown");
    expect(screen.getByRole("grid", { name: "January 2027" })).toBeTruthy();
    expect(document.activeElement).toBe(cell("2027-01-12"));
    press("PageUp");
    expect(document.activeElement).toBe(cell("2026-12-12"));
  });

  it("keeps focus on the right day when the new month arrives a render later, as it does from the URL", async () => {
    function FromUrl() {
      const [month, setMonth] = React.useState("2026-12");
      return <MonthCalendar month={month} events={[]} locale="en-US" onMonthChange={(next) => void setTimeout(() => setMonth(next), 0)} />;
    }
    renderWithQueries(<FromUrl />);
    act(() => cell("2026-12-12").focus());
    fireEvent.keyDown(document.activeElement!, { key: "PageDown" });
    await waitFor(() => expect(document.activeElement).toBe(cell("2027-01-12")));
    fireEvent.keyDown(document.activeElement!, { key: "PageUp" });
    await waitFor(() => expect(document.activeElement).toBe(cell("2026-12-12")));
  });

  it("Enter opens a day's events from the keyboard", () => {
    renderWithQueries(<Harness events={[event("one", "2026-12-01T15:00:00.000Z", "UTC")]} />);
    cell("2026-12-01").focus();
    fireEvent.keyDown(cell("2026-12-01"), { key: "Enter" });
    expect(screen.getByRole("region", { name: /December 1/ })).toBeTruthy();
  });
});

describe("event kinds", () => {
  it("gives a category the same one of eight fields every time, and none stone", () => {
    expect(kindClass("Coffee")).toBe(kindClass("Coffee"));
    expect(kindClass(null)).toBe("twc-kind");
    for (const c of ["Coffee", "Supper club", "Headshots", "Workshop", "Panel", "Zoom"]) expect(kindClass(c)).toMatch(/^twc-kind twc-kind--[0-7]$/);
  });

  it("colours each chip by its category and lists every category on screen once in the legend", () => {
    const at = "2026-12-10T15:00:00.000Z";
    const withCategory = (uid: string, category: string) => ({ ...event(uid, at, "UTC"), category });
    renderWithQueries(<Harness events={[withCategory("a", "Coffee"), withCategory("b", "Coffee"), withCategory("c", "Panel")]} />);
    expect(within(cell("2026-12-10")).getAllByRole("link")[0].className).toContain(kindClass("Coffee"));
    expect(within(screen.getByRole("list", { name: "Categories" })).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Coffee", "Panel"]);
  });
});
