// @vitest-environment jsdom
// The click glitter: stars around an enabled button, none for a disabled one or under reduced motion, all gone after.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SPARK_MS, useButtonSparkles } from "./sparkles";

function Page() {
  useButtonSparkles();
  return <><button type="button">Save</button><button type="button" disabled>Off</button><p>Text</p></>;
}
const stars = () => document.querySelectorAll(".twc-spark");
const reduce = (on: boolean) => vi.stubGlobal("matchMedia", (q: string) => ({ matches: on && q.includes("reduce") }));

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); document.querySelectorAll(".twc-spark").forEach((s) => s.remove()); });

describe("useButtonSparkles", () => {
  it("scatters hidden decorative stars around a clicked button, then removes them", () => {
    vi.useFakeTimers();
    reduce(false);
    render(<Page />);
    fireEvent.click(screen.getByText("Save"));
    expect(stars()).toHaveLength(8);
    expect([...stars()].every((s) => s.getAttribute("aria-hidden") === "true")).toBe(true);
    vi.advanceTimersByTime(SPARK_MS);
    expect(stars()).toHaveLength(0);
  });

  it("skips a disabled button, anything that isn't a button, and everything under reduced motion", () => {
    reduce(false);
    render(<Page />);
    fireEvent.click(screen.getByText("Off"));
    fireEvent.click(screen.getByText("Text"));
    expect(stars()).toHaveLength(0);
    reduce(true);
    fireEvent.click(screen.getByText("Save"));
    expect(stars()).toHaveLength(0);
  });

  it("stops listening when the page goes", () => {
    reduce(false);
    const { unmount } = render(<Page />);
    const save = screen.getByText("Save");
    unmount();
    document.body.append(save);
    fireEvent.click(save);
    expect(stars()).toHaveLength(0);
    save.remove();
  });
});
