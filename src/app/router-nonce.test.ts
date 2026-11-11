// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const startContext = vi.hoisted(() => vi.fn<() => unknown>());
vi.mock("@tanstack/react-start", async (original) => ({
  ...(await original<typeof import("@tanstack/react-start")>()),
  getGlobalStartContext: startContext,
}));

import { getRouter, requestNonce } from "@/router";
import { nonceProblems } from "../../scripts/smoke-cutover";

afterEach(() => startContext.mockReset());

// securityHeadersMiddleware names the nonce in the CSP; without it on the router, every SSR inline script is blocked.
describe("the router's CSP nonce", () => {
  it("is the request's nonce from the start context, on every SSR script", () => {
    startContext.mockReturnValue({ nonce: "abc" });
    expect(requestNonce()).toBe("abc");
    expect(getRouter().options.ssr?.nonce).toBe("abc");
  });

  it("is undefined without a request", () => {
    startContext.mockImplementation(() => {
      throw new Error("no start context");
    });
    expect(requestNonce()).toBeUndefined();
    expect(getRouter().options.ssr?.nonce).toBeUndefined();
    startContext.mockReturnValue(undefined);
    expect(getRouter().options.ssr?.nonce).toBeUndefined();
  });
});

describe("smoke-cutover nonceProblems", () => {
  const csp = "default-src 'self'; script-src 'self' 'nonce-n0Nc3'; object-src 'none'";

  it("passes a page whose inline scripts all carry the header's nonce", () => {
    const html = `<script nonce="n0Nc3">a()</script><script src="/assets/x.js"></script>
      <script type="application/ld+json">{}</script><script type="module" nonce="n0Nc3">b()</script>`;
    expect(nonceProblems(html, csp)).toEqual([]);
  });

  it("flags an inline script with no nonce or another one, and a CSP without a nonce", () => {
    expect(nonceProblems(`<script>a()</script><script nonce="other">b()</script>`, csp)).toHaveLength(2);
    expect(nonceProblems("<script nonce=\"n0Nc3\">a()</script>", "script-src 'self' 'unsafe-inline'")).toHaveLength(1);
    expect(nonceProblems("", null)).toHaveLength(1);
  });
});
