// Test-only stand-in for a feature's server functions (`src/features/*/fns.ts`):
//   vi.mock("@/features/members/fns", (orig) => fakeFns(orig));
// Every server function becomes a recorder: a call is logged as [name] or [name, data] in `fake.calls`, and
// resolves the next queued `fake.results` entry (an Error rejects; a pending Promise never settles).
export const fake = {
  calls: [] as unknown[][],
  results: [] as unknown[],
  reset() {
    this.calls = [];
    this.results = [];
  },
};

export async function fakeFns(importOriginal: () => Promise<unknown>) {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(mod).map((name) => [
      name,
      async (opts?: { data?: unknown }) => {
        fake.calls.push(opts?.data === undefined ? [name] : [name, opts.data]);
        const result = await fake.results.shift();
        if (result instanceof Error) throw result;
        return result ?? null;
      },
    ]),
  );
}

/** `vi.mock("@/app/api", async () => (await import("@/test/fake-fns")).fakeApi)`: records [path, body] in the same queue. */
export const fakeApi = {
  postApi: async (path: string, body: unknown) => {
    fake.calls.push([path, body]);
    const result = await fake.results.shift();
    if (result instanceof Error) throw result;
    return result ?? undefined;
  },
};
