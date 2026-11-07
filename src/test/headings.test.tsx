// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { headingLevels, headingSkips } from "./headings";

afterEach(cleanup);

describe("heading helpers", () => {
  it("allows one step down and any step back up", () => {
    const { container } = render(<><h1>A</h1><h2>B</h2><h3>C</h3><h2>D</h2><h3>E</h3><h4>F</h4><h2>G</h2></>);
    expect(headingSkips(container)).toEqual([]);
  });

  it("reports a skip downward", () => {
    const { container } = render(<><h1>Page</h1><h3>Section</h3></>);
    expect(headingSkips(container)).toEqual(['h1 "Page" → h3 "Section"']);
  });

  it("reads role=heading levels and ignores hidden headings", () => {
    const { container } = render(
      <><h1>Page</h1><div role="heading" aria-level={2}>Two</div><div hidden><h4>Hidden</h4></div><div aria-hidden="true"><h5>Decor</h5></div></>,
    );
    expect(headingLevels(container).map((h) => h.level)).toEqual([1, 2]);
  });
});
