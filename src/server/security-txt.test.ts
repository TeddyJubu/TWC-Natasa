import { afterEach, describe, expect, it, vi } from "vitest";
import { securityTxt } from "./security-txt";

describe("securityTxt", () => {
  const now = new Date("2026-11-11T12:00:00.123Z");
  const fields = Object.fromEntries(
    securityTxt("https://new.thewomenscollective.club", now).trim().split("\n").map((l) => l.split(/: (.*)/s).slice(0, 2)),
  );

  it("names the contact, a canonical URL on APP_URL and an RFC 3339 Expires a year ahead", () => {
    expect(fields.Contact).toBe("mailto:info@thewomenscollective.club");
    expect(fields.Canonical).toBe("https://new.thewomenscollective.club/.well-known/security.txt");
    expect(fields.Expires).toBe("2027-11-11T12:00:00Z");
  });

  it("is never expired when served", () => {
    const expires = /^Expires: (.+)$/m.exec(securityTxt("http://localhost:8080"))?.[1];
    expect(Date.parse(expires ?? "")).toBeGreaterThan(Date.now());
  });
});

describe("/.well-known/security.txt route", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("serves it as plain text on APP_URL", async () => {
    vi.stubEnv("APP_URL", "https://new.thewomenscollective.club/");
    const { Route } = await import("@/routes/[.]well-known/security[.]txt");
    const GET = (Route.options.server as { handlers: { GET: () => Promise<Response> } }).handlers.GET;
    const res = await GET();
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toContain("Canonical: https://new.thewomenscollective.club/.well-known/security.txt\n");
  });
});
