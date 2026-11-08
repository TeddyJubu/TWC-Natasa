import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ evaluated: false, client: { fake: true } }));
// Mocking by module id also catches relative-path imports: vitest resolves them to the same file.
vi.mock("better-auth/client", () => {
  state.evaluated = true;
  return { createAuthClient: () => state.client };
});

describe("Better Auth's client", () => {
  it("public entry routes and the session guard never load it at import time", async () => {
    await import("@/routes/__root");
    await import("@/routes/index");
    await import("@/routes/join");
    await import("@/routes/_authenticated/route");
    expect(state.evaluated).toBe(false);
  });

  it("getAuthClient loads it lazily, once", async () => {
    const { getAuthClient } = await import("@/app/auth-client");
    expect(state.evaluated).toBe(false);
    expect(await getAuthClient()).toBe(state.client);
    expect(await getAuthClient()).toBe(state.client);
    expect(state.evaluated).toBe(true);
  });
});
