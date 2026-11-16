// firstName / confirmFooter: greeting-safe names and the fixed confirmation footer.
import { afterEach, describe, expect, it, vi } from "vitest";
import { adminAddresses, confirmFooter, firstName, oneLine } from "./notify";

describe("firstName", () => {
  it("takes the first word of a plain name", () => {
    expect(firstName("Rosa Diaz")).toBe("Rosa");
    expect(firstName("  Ana-Maria  Ruiz ")).toBe("Ana-Maria");
    expect(firstName("O'Brien")).toBe("O'Brien");
  });

  it("falls back to 'there' for empty, URL-ish or address-ish words", () => {
    expect(firstName("")).toBe("there");
    expect(firstName("   ")).toBe("there");
    expect(firstName("https://evil.test")).toBe("there");
    expect(firstName("www.evil.test")).toBe("there");
    expect(firstName("a@b.test")).toBe("there");
    expect(firstName("Hi<script>")).toBe("there");
    expect(firstName("x".repeat(61))).toBe("there");
  });
});

describe("oneLine / confirmFooter", () => {
  it("strips line breaks from a subject fragment", () => {
    expect(oneLine("Bea\r\nBcc: x@evil.test")).toBe("Bea Bcc: x@evil.test");
  });

  it("names the form and says a stranger can ignore it", () => {
    expect(confirmFooter("contact form")).toContain("contact form");
    expect(confirmFooter("contact form")).toContain("If that wasn't you");
    expect(confirmFooter("contact form")).toContain("The Women's Collective");
  });
});

describe("adminAddresses", () => {
  const db = { prepare: () => ({ all: () => [{ email: "admin-a@x.test" }, { email: "admin-b@x.test" }] }) } as unknown as Parameters<typeof adminAddresses>[0];
  afterEach(() => { vi.unstubAllEnvs(); });

  it("is every admin account while ADMIN_ALERT_TO is unset", () => {
    vi.stubEnv("ADMIN_ALERT_TO", "");
    expect(adminAddresses(db)).toEqual(["admin-a@x.test", "admin-b@x.test"]);
  });

  it("is only the club inbox(es) in ADMIN_ALERT_TO when it is set", () => {
    vi.stubEnv("ADMIN_ALERT_TO", " club@x.test , second@x.test ,");
    expect(adminAddresses(db)).toEqual(["club@x.test", "second@x.test"]);
  });
});
