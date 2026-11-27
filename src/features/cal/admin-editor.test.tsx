// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";
import { matchCategory, nextWeekly } from "./admin-state";
import { EventEditorForm, PublishBar } from "./admin-ui";
import type { AdminCalEvent } from "./types";

const { save, list } = vi.hoisted(() => ({ save: vi.fn(), list: vi.fn() }));
vi.mock("./fns", async (original) => ({ ...(await original<typeof import("./fns")>()), saveCalEventFn: save, adminCalEventsFn: list }));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()), useNavigate: () => vi.fn(),
}));

const event: AdminCalEvent = {
  uid: "evt1", slug: "coffee-connection", title: "Coffee Connection", description: "Bring a friend", category: "Coffee", coverImageUrl: null, coverSrc: null,
  startTime: "2020-01-08T14:00:00.000Z", endTime: "2020-01-08T15:30:00.000Z", timeZone: "America/New_York", location: "Café", capacity: 12,
  status: "SCHEDULED", host: { name: "Host", username: "twc" }, goingCount: 3, maybeCount: 0, spotsLeft: 9, attendees: [], hidden: false, showAttendees: true,
};
const sent = () => save.mock.calls[0][0].data as { uid?: string; event: Record<string, unknown> };
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("category spelling", () => {
  it("takes the spelling already in use, whatever the case and spacing", () => {
    expect(matchCategory("  happy   hour ", ["Coffee", "Happy Hour"])).toBe("Happy Hour");
    expect(matchCategory("Book club", ["Coffee"])).toBe("Book club");
    expect(matchCategory("", ["Coffee"])).toBe("");
  });
});

describe("a duplicate's times", () => {
  it("is a week on when that is still ahead", () => {
    expect(nextWeekly("2030-01-08T09:00", "2030-01-08T10:30", "2030-01-01T00:00")).toEqual({ start: "2030-01-15T09:00", end: "2030-01-15T10:30" });
  });
  it("moves on by whole weeks past today, keeping the weekday and time", () => {
    const { start, end } = nextWeekly("2030-01-08T09:00", "2030-01-08T10:30", "2030-02-20T12:00");
    expect(start).toBe("2030-02-26T09:00");
    expect(end).toBe("2030-02-26T10:30");
  });
});

describe("the event editor", () => {
  it("creates a new event as a draft until it is published", async () => {
    list.mockResolvedValue({ events: [], total: 0, categories: [] });
    save.mockResolvedValue(event);
    renderWithQueries(<EventEditorForm />);
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "Supper" } });
    fireEvent.change(screen.getByLabelText(/^Starts/), { target: { value: "2030-03-01T19:00" } });
    fireEvent.change(screen.getByLabelText(/^Ends/), { target: { value: "2030-03-01T21:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(sent().event.hidden).toBe(true);
  });

  it("files a typed category under the one in use", async () => {
    list.mockResolvedValue({ events: [], total: 0, categories: ["Happy Hour"] });
    save.mockResolvedValue(event);
    renderWithQueries(<EventEditorForm event={event} />);
    await waitFor(() => expect(document.querySelector("datalist option[value='Happy Hour']")).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: "happy hour" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(sent().event.category).toBe("Happy Hour");
  });

  it("duplicates as a new draft a week on, with a dated web address and none of the original's id", async () => {
    list.mockResolvedValue({ events: [], total: 0, categories: [] });
    save.mockResolvedValue({ ...event, uid: "evt2" });
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2020-01-02T12:00:00Z") });
    renderWithQueries(<EventEditorForm template={event} />);
    vi.useRealTimers();
    expect((screen.getByLabelText(/^Starts/) as HTMLInputElement).value).toBe("2020-01-15T09:00");
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const body = sent();
    expect(body.uid).toBeUndefined();
    expect(body.event).toMatchObject({ title: "Coffee Connection", slug: "coffee-connection-2020-01-15", hidden: true, capacity: 12, location: "Café", category: "Coffee" });
  });
});

describe("publishing", () => {
  it("puts a draft on the calendar and changes nothing else", async () => {
    save.mockResolvedValue(event);
    renderWithQueries(<PublishBar event={{ ...event, hidden: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(sent().uid).toBe("evt1");
    expect(sent().event).toMatchObject({ hidden: false, title: "Coffee Connection", slug: "coffee-connection", capacity: 12, startTime: event.startTime });
  });

  it("shows nothing for a published or cancelled event", () => {
    const { container } = renderWithQueries(<><PublishBar event={event} /><PublishBar event={{ ...event, hidden: true, status: "CANCELLED" }} /></>);
    expect(container.textContent).toBe("");
  });
});
