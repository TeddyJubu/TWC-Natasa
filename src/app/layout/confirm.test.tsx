// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfirmHost } from "./ConfirmHost";
import { askConfirm } from "./confirm";

afterEach(cleanup);

async function open(message: string, label = "Delete") {
  render(<ConfirmHost />);
  let answer!: Promise<boolean>;
  act(() => { answer = askConfirm(message, label, true); });
  return { answer, dialog: await screen.findByRole("alertdialog") };
}

describe("askConfirm", () => {
  it("splits the question from its detail and starts on the safe answer", async () => {
    const { dialog } = await open("Delete this post? Its loves and replies go with it.");
    expect(screen.getByRole("heading", { name: "Delete this post?" })).toBeTruthy();
    expect(dialog.textContent).toContain("Its loves and replies go with it.");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" })));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  });

  it("resolves true only for the confirming button", async () => {
    const { answer } = await open("Delete this note?");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await expect(answer).resolves.toBe(true);
  });

  it("resolves false for Cancel", async () => {
    const { answer } = await open("Delete this note?");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await expect(answer).resolves.toBe(false);
  });

  it("resolves false for Escape", async () => {
    const { answer, dialog } = await open("Delete this note?");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await expect(answer).resolves.toBe(false);
  });
});
