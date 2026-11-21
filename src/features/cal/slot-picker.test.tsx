// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SlotPicker } from "./booking-ui";
import type { CalSlot } from "./types";

vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), ...(await import("@/test/dom")).routerStubs }));
afterEach(cleanup);

const slot = (start: string, seatsRemaining: number | null = null): CalSlot => ({ start, seatsBooked: null, seatsRemaining, seatsTotal: null });

describe("SlotPicker", () => {
  it("shows each time in the chosen zone", () => {
    const slots = [slot("2026-12-01T15:00:00.000Z")];
    const { unmount } = render(<SlotPicker slots={slots} timeZone="America/New_York" selected={null} onSelect={() => undefined} locale="en-US" />);
    expect(screen.getByRole("button").textContent).toContain("10:00");
    unmount();
    render(<SlotPicker slots={slots} timeZone="Asia/Tokyo" selected={null} onSelect={() => undefined} locale="en-US" />);
    expect(screen.getByRole("button").textContent).toContain("12:00");
  });
  it("reports the picked slot and marks the selected one", () => {
    const onSelect = vi.fn();
    render(<SlotPicker slots={[slot("2026-12-01T15:00:00.000Z"), slot("2026-12-01T16:00:00.000Z")]} timeZone="UTC" selected="2026-12-01T16:00:00.000Z" onSelect={onSelect} locale="en-US" />);
    const [first, second] = screen.getAllByRole("button");
    expect(second.getAttribute("aria-pressed")).toBe("true");
    expect(first.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(first);
    expect(onSelect).toHaveBeenCalledWith("2026-12-01T15:00:00.000Z");
  });
  it("shows seats left on a group slot", () => {
    render(<SlotPicker slots={[slot("2026-12-01T15:00:00.000Z", 2)]} timeZone="UTC" selected={null} onSelect={() => undefined} locale="en-US" />);
    expect(screen.getByRole("button").textContent).toContain("2 left");
  });
  it("asks for a day when there are none", () => {
    render(<SlotPicker slots={[]} timeZone="UTC" selected={null} onSelect={() => undefined} locale="en-US" />);
    expect(screen.getByText("Pick a day to see its times.")).toBeTruthy();
  });
});
