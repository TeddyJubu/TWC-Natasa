import { describe, expect, it } from "vitest";
import { locationKind, mapSearchUrl, openingMonth } from "./event-state";

describe("openingMonth", () => {
  const at = (startTime: string, timeZone = "America/New_York") => ({ startTime, timeZone });

  it("stays on this month with nothing ahead, or with an event still to come in it", () => {
    expect(openingMonth("2026-11")).toBe("2026-11");
    expect(openingMonth("2026-11", at("2026-11-29T23:00:00.000Z"))).toBe("2026-11");
  });

  it("moves to the next event's month when this one has nothing left, in the event's own zone", () => {
    expect(openingMonth("2026-11", at("2026-12-02T23:00:00.000Z"))).toBe("2026-12");
    expect(openingMonth("2026-11", at("2027-02-10T15:00:00.000Z"))).toBe("2027-02");
    // 1 Dec 03:00 UTC is still 30 Nov in New York.
    expect(openingMonth("2026-11", at("2026-12-01T03:00:00.000Z"))).toBe("2026-11");
  });
});

describe("locationKind", () => {
  it.each([
    ["Sunnyside Bakery, 41-10 Queens Blvd", "place"],
    ["Astoria Park", "place"],
    ["https://example.org/room", "url"],
    ["Zoom", "online"],
    ["Online", "online"],
    ["Google Meet", "online"],
    ["integrations:daily", "online"],
    ["www.zoom.us/j/123", "online"],
    ["Join at https://zoom.us/j/1", "online"],
  ] as const)("%s is %s", (location, kind) => expect(locationKind(location)).toBe(kind));

  it("builds Google's documented map search, encoded", () => {
    expect(mapSearchUrl(" Café & Co, Astoria ")).toBe("https://www.google.com/maps/search/?api=1&query=Caf%C3%A9%20%26%20Co%2C%20Astoria");
  });
});
