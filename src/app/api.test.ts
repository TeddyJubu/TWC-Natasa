import { afterEach, describe, expect, it, vi } from "vitest";
import { postApi } from "./api";

const fetchMock = vi.fn();
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("postApi", () => {
  it("sends JSON or FormData and returns the JSON result (undefined for 204)", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(Response.json({ ok: 1 })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    const form = new FormData();
    expect(await postApi("/api/images", form)).toEqual({ ok: 1 });
    expect(await postApi("/api/applications", { a: 1 })).toBeUndefined();
    expect(fetchMock.mock.calls[0]).toEqual(["/api/images", { method: "POST", body: form, headers: undefined }]);
    expect(fetchMock.mock.calls[1]).toEqual(["/api/applications", { method: "POST", body: '{"a":1}', headers: { "Content-Type": "application/json" } }]);
  });

  it("throws the server's message, or a generic one", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(Response.json({ error: "Too many applications from here." }, { status: 429 }))
      .mockResolvedValueOnce(new Response("<html>", { status: 502 }));
    await expect(postApi("/api/applications", {})).rejects.toThrow("Too many applications from here.");
    await expect(postApi("/api/applications", {})).rejects.toThrow("Something went wrong. Please try again.");
  });
});
