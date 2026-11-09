// CRM-010: unknown /api/* answers JSON 404 (src/server/api-notfound.ts via src/routes/api/$.ts).
import { describe, expect, it } from "vitest";
import { apiNotFound } from "@/server/api-notfound";

describe("unknown /api/* (CRM-010)", () => {
  it("returns JSON 404 with no-store", async () => {
    const res = apiNotFound();
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "Not found" });
  });
});
