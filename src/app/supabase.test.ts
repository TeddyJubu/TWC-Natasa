import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ evaluated: false, fakeClient: { fake: true } }));

vi.mock("@/integrations/supabase/client", () => {
  state.evaluated = true;
  return { supabase: state.fakeClient };
});

describe("getSupabase", () => {
  it("does not evaluate the client module on import, and resolves it lazily", async () => {
    const { getSupabase } = await import("@/app/supabase");
    expect(state.evaluated).toBe(false);
    expect(await getSupabase()).toBe(state.fakeClient);
    expect(state.evaluated).toBe(true);
  });
});
