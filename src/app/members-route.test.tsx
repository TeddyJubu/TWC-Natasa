// /members: the old public catalogue. The directory is members-only (owner decision, 2026-11-24), so the route only
// sends everyone to /directory and loads nothing that could put a member in the server's HTML.
import { describe, expect, it, vi } from "vitest";
import { isRedirect } from "@tanstack/react-router";

vi.mock("@/features/members/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));
vi.mock("@/features/auth/fns", async (orig) => (await import("@/test/fake-fns")).fakeFns(orig));

import { fake } from "@/test/fake-fns";
import { Route } from "@/routes/members";

describe("/members", () => {
  it("redirects everyone to /directory before loading anything", () => {
    let thrown: unknown;
    try {
      (Route.options.beforeLoad as () => void)();
    } catch (e) {
      thrown = e;
    }
    expect(isRedirect(thrown)).toBe(true);
    expect((thrown as { options: { to: string } }).options.to).toBe("/directory");
    expect(fake.calls).toEqual([]);
  });

  it("has no loader and no page, so no member data can reach a visitor", () => {
    expect(Route.options.loader).toBeUndefined();
    expect(Route.options.component).toBeUndefined();
  });
});
