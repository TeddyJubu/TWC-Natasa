// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderWithQueries } from "@/test/dom";
import { gatheringsLd } from "@/features/events/structured-data";
import { EventEditorForm } from "./admin-ui";
import { CoverImage } from "./events-ui";
import type { AdminCalEvent } from "./types";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("./fns", async (original) => ({ ...(await original<typeof import("./fns")>()), saveCalEventFn: save, adminCalEventsFn: vi.fn().mockResolvedValue({ events: [], total: 0, categories: [] }) }));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()), useNavigate: () => vi.fn(),
}));

const SOURCE = "https://images.example/supper.jpg?w=1200";
const SRC = "/media/covers/evt1?v=abc123def456";
const event: AdminCalEvent = {
  uid: "evt1", slug: "supper", title: "Supper club", description: null, category: null, coverImageUrl: SOURCE, coverSrc: SRC,
  startTime: "2030-01-10T23:00:00.000Z", endTime: "2030-01-11T01:00:00.000Z", timeZone: "America/New_York", location: null, capacity: null,
  status: "SCHEDULED", host: { name: "Host", username: "twc" }, goingCount: 0, maybeCount: 0, spotsLeft: null, attendees: [], hidden: false, showAttendees: true,
};
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("CoverImage", () => {
  const image = (container: HTMLElement) => container.querySelector("img");

  it("shows the same-origin copy, never the source address", () => {
    const { container } = render(<CoverImage event={event} />);
    expect(image(container)?.getAttribute("src")).toBe(SRC);
    expect(container.innerHTML).not.toContain("images.example");
  });

  it("shows the fallback with no cover", () => {
    render(<CoverImage event={{ coverSrc: null }} fallback={<p>date tile</p>} />);
    expect(screen.getByText("date tile")).toBeTruthy();
  });

  it("shows the fallback when the cover fails", () => {
    const { container } = render(<CoverImage event={event} fallback={<p>date tile</p>} />);
    fireEvent.error(image(container)!);
    expect(image(container)).toBeNull();
    expect(screen.getByText("date tile")).toBeTruthy();
  });

  it("shows the fallback for a cover that failed before hydration", () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    const width = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
    render(<CoverImage event={event} fallback={<p>date tile</p>} />);
    expect(screen.getByText("date tile")).toBeTruthy();
    complete.mockRestore();
    width.mockRestore();
  });

  it("tries again when the event gets a new cover", () => {
    const { container, rerender } = render(<CoverImage event={event} fallback={<p>date tile</p>} />);
    fireEvent.error(image(container)!);
    rerender(<CoverImage event={{ coverSrc: "/media/covers/evt1?v=fedcba654321" }} fallback={<p>date tile</p>} />);
    expect(image(container)?.getAttribute("src")).toContain("fedcba654321");
  });
});

describe("the event editor", () => {
  it("saves the real cover address back, not the same-origin copy", async () => {
    save.mockResolvedValue(event);
    renderWithQueries(<EventEditorForm event={event} />);
    expect((screen.getByLabelText(/Cover image address/) as HTMLInputElement).value).toBe(SOURCE);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const sent = save.mock.calls[0][0].data.event as Record<string, unknown>;
    expect(sent.coverImageUrl).toBe(SOURCE);
    expect(sent).not.toHaveProperty("coverSrc");
  });

  it("shows no preview of an unsaved address, so typing one loads nothing from another site", () => {
    const { container } = renderWithQueries(<EventEditorForm event={event} />);
    fireEvent.change(screen.getByLabelText(/Cover image address/), { target: { value: "https://elsewhere.example/new.jpg" } });
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("structured data", () => {
  const imageOf = (site: string, over: Partial<AdminCalEvent> = {}) =>
    (gatheringsLd(site, [{ ...event, ...over }])!["@graph"][1] as { image?: string }).image;

  it("uses our own absolute https address", () => {
    expect(imageOf("https://club.example")).toBe(`https://club.example${SRC}`);
  });
  it("has no image without a cover or on a site that isn't https", () => {
    expect(imageOf("https://club.example", { coverSrc: null })).toBeUndefined();
    expect(imageOf("http://localhost:3000")).toBeUndefined();
  });
});
