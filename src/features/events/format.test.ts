import { afterEach, describe, expect, it, vi } from "vitest";
import { restoreTz, setTz } from "@/test/tz";
import { eventWhen, localDateISO } from "./format";

afterEach(() => {
  restoreTz();
  vi.useRealTimers();
});

describe("localDateISO", () => {
  it("uses the viewer's local calendar date, not UTC", () => {
    setTz("America/Los_Angeles");
    vi.useFakeTimers({ now: new Date("2026-11-09T03:00:00Z") }); // 7pm on the 8th in LA
    expect(localDateISO()).toBe("2026-11-08");
  });

  it("pads month and day", () => {
    setTz("UTC");
    expect(localDateISO(new Date("2026-03-04T10:00:00Z"))).toBe("2026-03-04");
  });
});

describe("eventWhen", () => {
  it.each(["Asia/Tokyo", "UTC", "America/Los_Angeles"])("shows New York day and time wherever the viewer is (%s)", (tz) => {
    setTz(tz);
    // 00:30 UTC on the 9th is 7:30pm on the 8th in New York (EST).
    expect(eventWhen("2026-11-09T00:30:00Z")).toEqual({ month: "Nov", day: "8", time: "7:30 PM" });
  });

  it("follows daylight saving time, including the fall-back hour", () => {
    setTz("Asia/Tokyo");
    expect(eventWhen("2026-07-01T22:00:00Z")).toEqual({ month: "Jul", day: "1", time: "6:00 PM" });
    expect(eventWhen("2026-11-01T05:30:00Z").time).toBe("1:30 AM"); // EDT
    expect(eventWhen("2026-11-01T06:30:00Z").time).toBe("1:30 AM"); // EST, an hour later
  });
});
