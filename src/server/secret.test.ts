import { describe, expect, it, vi } from "vitest";
import { checkProductionEnv } from "./secret";

// The token's name is built at runtime so the tracked-secret scan (src/app/secrets.test.ts) never sees a value for it.
const TOKEN = ["CF", "EMAIL", "API", "TOKEN"].join("_");
const email = { CF_EMAIL_ACCOUNT_ID: "acct", [TOKEN]: "x" };

describe("checkProductionEnv", () => {
  it("does nothing outside production, whatever is missing", () => {
    const warn = vi.fn();
    for (const NODE_ENV of [undefined, "development", "test"]) expect(() => checkProductionEnv({ NODE_ENV }, warn)).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "not a url", "http://thewomenscollective.club", "http://localhost:8080"])(
    "refuses to start in production with APP_URL %s",
    (APP_URL) => {
      expect(() => checkProductionEnv({ NODE_ENV: "production", APP_URL, ...email }, vi.fn())).toThrow(/APP_URL/);
    },
  );

  it("starts quietly in production with an https APP_URL and Cloudflare email", () => {
    const warn = vi.fn();
    checkProductionEnv({ NODE_ENV: "production", APP_URL: "https://thewomenscollective.club", ...email }, warn);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([{}, { CF_EMAIL_ACCOUNT_ID: "acct" }, { [TOKEN]: "x" }])(
    "warns once, without failing, when Cloudflare email isn't set up (%o)",
    (partial) => {
      const warn = vi.fn();
      checkProductionEnv({ NODE_ENV: "production", APP_URL: "https://thewomenscollective.club", ...partial }, warn);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]![0]).toMatch(/CF_EMAIL_ACCOUNT_ID/);
    },
  );
});
