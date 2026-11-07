// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemberCard, type MemberProfile } from "./member-card";
import { MemberDialog } from "./member-dialog";

// jsdom has no modal dialog: stub showModal/close so they toggle `open`, move focus in, and fire `close`
// like a browser. (jsdom defines neither, so the stubs are deleted again afterwards.)
beforeEach(() => {
  vi.stubGlobal("matchMedia", (media: string) => ({ media, matches: true, addEventListener() {}, removeEventListener() {} }));
  const svgText = SVGElement.prototype as SVGElement & { getComputedTextLength?: () => number };
  svgText.getComputedTextLength ??= () => 0;
  const proto = HTMLDialogElement.prototype as Partial<HTMLDialogElement>;
  proto.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
    this.querySelector<HTMLElement>("[autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")?.focus();
  });
  proto.close = vi.fn(function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
});
afterEach(() => {
  cleanup();
  const proto = HTMLDialogElement.prototype as Partial<HTMLDialogElement>;
  delete proto.showModal;
  delete proto.close;
  vi.unstubAllGlobals();
});

const member: MemberProfile = {
  id: "m1", name: "Rosa Diaz", role: "Founder", business: "Diaz Bakery", neighborhood: "Astoria",
  specialty: "Food", bio: "I bake sourdough for the block.", lookingFor: "Café owners who want fresh bread",
  image: "/x.jpg", imageAlt: "Portrait of Rosa Diaz", website: "https://diaz.example",
};

describe("MemberCard trigger", () => {
  it("is a button named for the member that calls onOpen", () => {
    const onOpen = vi.fn();
    render(<MemberCard member={member} variant="catalogue" onOpen={onOpen} />);
    const trigger = screen.getByRole("button", { name: "View Rosa Diaz’s profile" });
    expect(trigger.getAttribute("type")).toBe("button");
    fireEvent.click(trigger);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  // Safari and Firefox don't focus a clicked button; the trigger has to, so the dialog can return focus to it.
  it("takes focus when clicked, before calling onOpen", () => {
    let focusedAtOpen: Element | null = null;
    render(<MemberCard member={member} variant="catalogue" onOpen={() => { focusedAtOpen = document.activeElement; }} />);
    const trigger = screen.getByRole("button", { name: "View Rosa Diaz’s profile" });
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(trigger);
    expect(focusedAtOpen).toBe(trigger);
  });

  // Inner canvas + outer ring: one of the two contrasts with any neighborhood colour behind it.
  it("draws a two-tone inset focus ring", () => {
    render(<MemberCard member={member} variant="catalogue" onOpen={() => {}} />);
    const trigger = screen.getByRole("button", { name: "View Rosa Diaz’s profile" });
    expect(trigger.className).toContain("focus-visible:shadow-[inset_0_0_0_2px_var(--bl-canvas),inset_0_0_0_4px_var(--bl-sky)]");
  });

  // The z-40 trigger must stay inside the card's own stacking context, under the sticky nav.
  it.each(["grid", "featured"] as const)("isolates a %s card that opens", (variant) => {
    const { container } = render(<MemberCard member={member} variant={variant} onOpen={() => {}} />);
    expect(container.querySelector("article")?.className).toMatch(/(^|\s)relative(\s|$)/);
    expect(container.querySelector("article")?.className).toMatch(/(^|\s)isolate(\s|$)/);
  });

  it("is absent without onOpen", () => {
    render(<MemberCard member={member} variant="catalogue" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("MemberDialog", () => {
  it("renders nothing open without a member", () => {
    const { container } = render(<MemberDialog member={null} onClose={() => {}} />);
    expect(container.querySelector("dialog")?.open).toBe(false);
  });

  it("opens modally and shows the member's details", () => {
    render(<MemberDialog member={member} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "Rosa Diaz, member profile" });
    expect(dialog.className).toContain("overscroll-contain");
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Rosa Diaz" })).toBeTruthy();
    expect(dialog.textContent).toContain("Founder · Diaz Bakery");
    expect(dialog.textContent).toContain("Astoria");
    expect(dialog.textContent).toContain("I bake sourdough for the block.");
    expect(dialog.textContent).toContain("Looking to meet");
    expect(dialog.textContent).toContain("Café owners who want fresh bread");
  });

  it("omits empty sections", () => {
    render(<MemberDialog member={{ ...member, neighborhood: "", bio: "", lookingFor: "", website: undefined }} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).not.toContain("Astoria");
    expect(dialog.textContent).not.toContain("Looking to meet");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("joins role and business only from the parts that exist", () => {
    const { rerender } = render(<MemberDialog member={{ ...member, role: "" }} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Diaz Bakery");
    expect(dialog.textContent).not.toContain("·");
    rerender(<MemberDialog member={{ ...member, role: "", business: "" }} onClose={() => {}} />);
    expect(dialog.textContent).not.toContain("·");
    expect([...dialog.querySelectorAll("p")].filter((p) => !p.textContent?.trim())).toHaveLength(0);
  });

  it("treats whitespace-only bio, looking-for and website as empty", () => {
    render(<MemberDialog member={{ ...member, bio: "  ", lookingFor: " \n ", website: "   " }} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).not.toContain("Looking to meet");
    expect(dialog.textContent).not.toContain("Website");
    expect([...dialog.querySelectorAll("p")].filter((p) => !p.textContent?.trim())).toHaveLength(0);
  });

  it("links a padded website by its trimmed URL", () => {
    render(<MemberDialog member={{ ...member, website: "  https://diaz.example  " }} onClose={() => {}} />);
    expect(screen.getByRole("link", { name: /diaz\.example/ }).getAttribute("href")).toBe("https://diaz.example");
  });

  it("links an http(s) website in a new tab, safely", () => {
    render(<MemberDialog member={member} onClose={() => {}} />);
    const link = screen.getByRole("link", { name: /diaz\.example/ });
    expect(link.getAttribute("href")).toBe("https://diaz.example");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("never links a non-http website", () => {
    render(<MemberDialog member={{ ...member, website: "javascript:alert(1)" }} onClose={() => {}} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(document.querySelector("a[href^='javascript']")).toBeNull();
  });

  it("closes from the close button", () => {
    const onClose = vi.fn();
    render(<MemberDialog member={member} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("on Escape asks the caller to close, and stays open until it clears member", () => {
    const onClose = vi.fn();
    const { rerender } = render(<MemberDialog member={member} onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog.hasAttribute("open")).toBe(true);
    rerender(<MemberDialog member={null} onClose={onClose} />);
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reports a native close while open to the caller", () => {
    const onClose = vi.fn();
    render(<MemberDialog member={member} onClose={onClose} />);
    (screen.getByRole("dialog") as HTMLDialogElement).close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a press that starts and ends on the backdrop", () => {
    const onClose = vi.fn();
    render(<MemberDialog member={member} onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open when a press inside (e.g. a text selection) is released on the backdrop", () => {
    const onClose = vi.fn();
    render(<MemberDialog member={member} onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.pointerDown(screen.getByText("I bake sourdough for the block."));
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });

  // Closing before paint: no frame shows an open dialog whose content has already unmounted.
  it("is closed by the time an emptied dialog could paint", () => {
    const frames: { open: boolean; empty: boolean }[] = [];
    function Probe() {
      React.useLayoutEffect(() => {
        const dialog = document.querySelector("dialog")!;
        frames.push({ open: dialog.open, empty: dialog.childElementCount === 0 });
      });
      return null;
    }
    const { rerender } = render(<><MemberDialog member={member} onClose={() => {}} /><Probe /></>);
    rerender(<><MemberDialog member={null} onClose={() => {}} /><Probe /></>);
    expect(frames.at(-1)?.empty).toBe(true);
    expect(frames.filter((f) => f.open && f.empty)).toEqual([]);
  });

  it("returns focus to the card trigger after closing", () => {
    function Harness() {
      const [open, setOpen] = React.useState<MemberProfile | null>(null);
      return (
        <>
          <MemberCard member={member} variant="catalogue" onOpen={() => setOpen(member)} />
          <MemberDialog member={open} onClose={() => setOpen(null)} />
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "View Rosa Diaz’s profile" });
    // No trigger.focus(): like Safari/Firefox, the click alone doesn't focus the button.
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("doesn't refocus a trigger that left the page while the dialog was open", () => {
    function Harness({ showCard }: { showCard: boolean }) {
      const [open, setOpen] = React.useState<MemberProfile | null>(null);
      return (
        <>
          {showCard && <MemberCard member={member} variant="catalogue" onOpen={() => setOpen(member)} />}
          <MemberDialog member={open} onClose={() => setOpen(null)} />
        </>
      );
    }
    const { rerender } = render(<Harness showCard />);
    const trigger = screen.getByRole("button", { name: "View Rosa Diaz’s profile" });
    fireEvent.click(trigger);
    const focus = vi.spyOn(trigger, "focus");
    rerender(<Harness showCard={false} />);
    expect(trigger.isConnected).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(focus).not.toHaveBeenCalled();
  });
});
