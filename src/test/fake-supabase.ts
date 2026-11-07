// Test-only stand-in for the client returned by getSupabase(). Every builder call is
// recorded; each awaited chain (or storage call) takes the next queued result.
type Result = { data: unknown; error: unknown };

export const fake = {
  calls: [] as unknown[][],
  results: [] as Result[],
  reset() {
    this.calls = [];
    this.results = [];
  },
};

const next = () => fake.results.shift() ?? { data: null, error: null };

function chain(): unknown {
  const proxy: unknown = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") {
          const r = next();
          return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(r).then(res, rej);
        }
        return (...args: unknown[]) => {
          fake.calls.push([prop, ...args]);
          return proxy;
        };
      },
    },
  );
  return proxy;
}

export const fakeClient = {
  from: (table: string) => (fake.calls.push(["from", table]), chain()),
  rpc: (fn: string, args?: unknown) => (fake.calls.push(["rpc", fn, ...(args ? [args] : [])]), chain()),
  storage: {
    from: (bucket: string) => ({
      upload: async (...args: unknown[]) => (fake.calls.push(["upload", bucket, ...args]), next()),
      createSignedUrls: async (...args: unknown[]) => (fake.calls.push(["createSignedUrls", bucket, ...args]), next()),
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${bucket}/${path}` } }),
    }),
  },
};

export const fakeSupabaseModule = { getSupabase: async () => fakeClient };
