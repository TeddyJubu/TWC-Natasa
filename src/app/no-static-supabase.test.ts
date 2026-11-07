import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ evaluated: false }));

// Mocking by module id also catches relative-path imports: vitest resolves them to the same file.
vi.mock("@/integrations/supabase/client", () => {
  state.evaluated = true;
  return { supabase: {} };
});

describe("public entry routes never evaluate the Supabase client at import time", () => {
  it("__root, _authenticated/route, index and join leave the client module unevaluated", async () => {
    await import("@/routes/__root");
    await import("@/routes/index");
    await import("@/routes/join");
    await import("@/routes/_authenticated/route");
    expect(state.evaluated).toBe(false);
  });
});
