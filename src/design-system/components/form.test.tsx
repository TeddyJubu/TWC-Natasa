// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChoiceGroup, FormField, FormNotice, FormSection, Input, RadioGroup } from "./form";

afterEach(cleanup);

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];
const box = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const form = () => document.querySelector("form") as HTMLFormElement;

describe("FormField", () => {
  it("gives its child the id and points it at the hint", () => {
    render(<FormField label="Name" htmlFor="name" hint="Your full name."><Input /></FormField>);
    const input = screen.getByLabelText("Name");
    expect(input.id).toBe("name");
    expect(input.getAttribute("aria-describedby")).toBe("name-hint");
    expect(document.getElementById("name-hint")?.textContent).toBe("Your full name.");
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("points at the error and marks the child invalid", () => {
    render(<FormField label="Email" htmlFor="email" error="Enter a complete email."><Input /></FormField>);
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain("email-error");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").id).toBe("email-error");
  });

  it("merges an existing aria-describedby and keeps an explicit id", () => {
    render(
      <FormField label="Bio" htmlFor="bio" hint="Short.">
        <Input id="bio-input" data-testid="bio" aria-describedby="bio-counter" />
      </FormField>,
    );
    const input = screen.getByTestId("bio");
    expect(input.id).toBe("bio-input");
    expect(input.getAttribute("aria-describedby")?.split(" ").sort()).toEqual(["bio-counter", "bio-hint"]);
  });

  it("adds no describedby when there is no hint or error", () => {
    render(<FormField label="Plain" htmlFor="plain"><Input /></FormField>);
    const input = screen.getByLabelText("Plain");
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  it("leaves multiple children untouched", () => {
    render(<FormField label="Pair" htmlFor="pair-a"><Input data-testid="one" /><Input data-testid="two" /></FormField>);
    expect(screen.getByTestId("one").id).toBe("");
    expect(screen.getByTestId("two").id).toBe("");
  });
});

describe("ChoiceGroup value", () => {
  it("is controlled by value and reports the next array", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<ChoiceGroup name="g" legend="Pick" options={options} value={["a"]} onValueChange={onValueChange} />);
    expect(box("Alpha").checked).toBe(true);
    expect(box("Beta").checked).toBe(false);
    fireEvent.click(box("Beta"));
    expect(onValueChange).toHaveBeenLastCalledWith(["a", "b"]);
    expect(box("Beta").checked).toBe(false);
    rerender(<ChoiceGroup name="g" legend="Pick" options={options} value={["a", "b"]} onValueChange={onValueChange} />);
    expect(box("Beta").checked).toBe(true);
  });

  it("pre-checks defaultValue when uncontrolled", () => {
    const onValueChange = vi.fn();
    render(<ChoiceGroup name="g" legend="Pick" options={options} defaultValue={["c"]} onValueChange={onValueChange} />);
    expect(box("Gamma").checked).toBe(true);
    fireEvent.click(box("Alpha"));
    expect(box("Alpha").checked).toBe(true);
    expect(onValueChange).toHaveBeenLastCalledWith(["c", "a"]);
  });
});

describe("ChoiceGroup required", () => {
  it("blocks submission until one box is checked and shows the alert on invalid", () => {
    render(<form><ChoiceGroup name="g" legend="Pick" options={options} required /></form>);
    expect(form().checkValidity()).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
    act(() => { form().reportValidity(); });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Choose at least one option.");
    expect(box("Alpha").getAttribute("aria-describedby")?.split(" ")).toContain(alert.id);
    fireEvent.click(box("Beta"));
    expect(form().checkValidity()).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("validates in controlled mode with a custom message", () => {
    const Controlled = () => {
      const [value, setValue] = React.useState<string[]>([]);
      return <form><ChoiceGroup name="g" legend="Pick" options={options} required requiredMessage="Pick one." value={value} onValueChange={setValue} /></form>;
    };
    render(<Controlled />);
    expect(form().checkValidity()).toBe(false);
    act(() => { box("Alpha").dispatchEvent(new Event("invalid")); });
    expect(screen.getByRole("alert").textContent).toBe("Pick one.");
    fireEvent.click(box("Gamma"));
    expect(form().checkValidity()).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(box("Gamma"));
    expect(form().checkValidity()).toBe(false);
  });
});

describe("ChoiceGroup validity sync", () => {
  it("moves the required message to the new first box when options change", () => {
    const { rerender } = render(<form><ChoiceGroup name="g" legend="Pick" options={options} required /></form>);
    expect(box("Alpha").validity.valid).toBe(false);
    rerender(<form><ChoiceGroup name="g" legend="Pick" options={[{ value: "z", label: "Zed" }, ...options]} required /></form>);
    expect(box("Zed").validity.valid).toBe(false);
    expect(box("Alpha").validity.valid).toBe(true);
    expect(form().checkValidity()).toBe(false);
  });

  it("re-syncs after form.reset() in uncontrolled mode", async () => {
    const onValueChange = vi.fn();
    render(<form><ChoiceGroup name="g" legend="Pick" options={options} required onValueChange={onValueChange} /></form>);
    fireEvent.click(box("Beta"));
    expect(form().checkValidity()).toBe(true);
    await act(async () => {
      form().reset();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(box("Beta").checked).toBe(false);
    expect(form().checkValidity()).toBe(false);
    // Internal state matches the DOM again: checking Alpha reports only Alpha.
    fireEvent.click(box("Alpha"));
    expect(onValueChange).toHaveBeenLastCalledWith(["a"]);
  });

  it("keeps the error hidden after a controlled value fills and empties without a new invalid event", () => {
    const { rerender } = render(<form><ChoiceGroup name="g" legend="Pick" options={options} required value={[]} onValueChange={() => {}} /></form>);
    act(() => { box("Alpha").dispatchEvent(new Event("invalid")); });
    expect(screen.getByRole("alert")).toBeTruthy();
    rerender(<form><ChoiceGroup name="g" legend="Pick" options={options} required value={["b"]} onValueChange={() => {}} /></form>);
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<form><ChoiceGroup name="g" legend="Pick" options={options} required value={[]} onValueChange={() => {}} /></form>);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(form().checkValidity()).toBe(false);
    act(() => { box("Alpha").dispatchEvent(new Event("invalid")); });
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});

describe("RadioGroup", () => {
  const radios = [{ value: "x", label: "Ex" }, { value: "y", label: "Why" }];

  it("checks the controlled value", () => {
    const { rerender } = render(<RadioGroup name="r" legend="Pick" options={radios} value="y" onValueChange={() => {}} />);
    expect(box("Why").checked).toBe(true);
    expect(box("Ex").checked).toBe(false);
    rerender(<RadioGroup name="r" legend="Pick" options={radios} value="x" onValueChange={() => {}} />);
    expect(box("Ex").checked).toBe(true);
  });

  it("passes required to the radios", () => {
    render(<form><RadioGroup name="r" legend="Pick" options={radios} required /></form>);
    expect(box("Ex").required).toBe(true);
    expect(form().checkValidity()).toBe(false);
    fireEvent.click(box("Why"));
    expect(form().checkValidity()).toBe(true);
  });
});

describe("FormSection", () => {
  it("names its fieldset once, from the visible heading (no duplicate sr-only legend)", () => {
    const { container } = render(<FormSection index="01" title="Start With You"><Input aria-label="x" /></FormSection>);
    const group = screen.getByRole("group", { name: "Start With You" });
    expect(container.querySelector("legend")).toBeNull();
    const heading = screen.getByRole("heading", { name: "Start With You" });
    expect(heading.tagName).toBe("H3");
    expect(group.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(screen.getAllByText("Start With You")).toHaveLength(1);
  });

  it("takes the heading level from headingAs", () => {
    render(<FormSection title="Your work" headingAs="h2" />);
    expect(screen.getByRole("heading", { name: "Your work", level: 2 })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Your work" })).toBeTruthy();
  });
});

describe("FormNotice", () => {
  it("defaults to an h4 title and takes another level from headingAs", () => {
    render(<><FormNotice title="Default">a</FormNotice><FormNotice title="Nested" headingAs="h3">b</FormNotice></>);
    expect(screen.getByRole("heading", { name: "Default", level: 4 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Nested", level: 3 })).toBeTruthy();
  });
});
