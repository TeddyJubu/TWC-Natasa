import { afterAll, describe, expect, it } from "vitest";
import { restoreTz, setTz } from "@/test/tz";
import { lovedLine, postedAgo } from "./format";

describe("postedAgo", () => {
  // Wednesday 11 November 2026, 10:00 in New York.
  const now = new Date("2026-11-11T15:00:00Z");
  const ago = (iso: string) => postedAgo(iso, now);

  it("counts minutes, then hours, for the first day", () => {
    expect(ago("2026-11-11T14:59:40Z")).toBe("Just now");
    expect(ago("2026-11-11T14:48:00Z")).toBe("12m");
    expect(ago("2026-11-11T12:00:00Z")).toBe("3h");
    expect(ago("2026-11-10T16:00:00Z")).toBe("23h");
  });

  it("then names New York days, whatever the reader's own timezone", () => {
    setTz("Asia/Tokyo");
    expect(ago("2026-11-10T14:00:00Z")).toBe("Yesterday");
    expect(ago("2026-11-09T15:00:00Z")).toBe("Monday");
    expect(ago("2026-11-03T15:00:00Z")).toBe("Nov 3");
    expect(ago("2025-12-24T15:00:00Z")).toBe("Dec 24, 2025");
  });
  afterAll(restoreTz);
});

describe("lovedLine", () => {
  it("puts her first, names up to two, and counts the rest", () => {
    expect(lovedLine(1, true, [])).toBe("You loved this");
    expect(lovedLine(2, true, ["Cara"])).toBe("You and Cara loved this");
    expect(lovedLine(23, false, ["Lucía Ferreira", "Aiko Tanaka"])).toBe("Lucía Ferreira, Aiko Tanaka and 21 others loved this");
    expect(lovedLine(3, true, ["Cara", "Ada"])).toBe("You, Cara and 1 other loved this");
    expect(lovedLine(2, false, [])).toBe("2 members loved this");
  });
});
