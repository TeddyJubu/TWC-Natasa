// /partnerships inquiries: the shared check, and the POST /api/partnerships stub (size first, body unread, 501).
import { describe, expect, it } from "vitest";
import { checkPartnership, COLLABORATIONS, PARTNERSHIP_LIMITS } from "./partnership";
import { PARTNERSHIP_NOT_READY, partnershipRequest } from "./partnership.server";

const good = { name: " Rosa Diaz ", email: "rosa@x.test", business: "Rosa’s Ceramics", collaboration_type: "host", message: "A room.", consent: "on", honeypot: "" };

describe("checkPartnership", () => {
  it("trims and returns the exact wire contract", () => {
    expect(checkPartnership(good)).toEqual({
      value: { kind: "partnership", name: "Rosa Diaz", email: "rosa@x.test", business: "Rosa’s Ceramics", collaboration_type: "host", message: "A room.", consent: true, honeypot: "" },
    });
  });

  it("accepts every collaboration type and JSON consent: true", () => {
    for (const c of COLLABORATIONS) expect(checkPartnership({ ...good, collaboration_type: c.value, consent: true })).toHaveProperty("value");
  });

  it("reports each bad field, in form order", () => {
    const result = checkPartnership({ name: "", email: "nope", business: "", collaboration_type: "sell", message: "", consent: false });
    expect(result).toHaveProperty("errors");
    expect(Object.keys((result as { errors: object }).errors)).toEqual(["name", "email", "business", "collaboration_type", "message", "consent"]);
  });

  it("enforces the limits and never trusts a non-string", () => {
    expect(checkPartnership({ ...good, message: "x".repeat(PARTNERSHIP_LIMITS.message + 1) })).toHaveProperty("errors.message");
    expect(checkPartnership({ ...good, name: 5 })).toHaveProperty("errors.name");
    expect(checkPartnership({ ...good, consent: "yes" })).toHaveProperty("errors.consent");
  });

  it("keeps a honeypot value so the server can drop the bot", () => {
    expect(checkPartnership({ ...good, honeypot: "spam" })).toHaveProperty("value.honeypot", "spam");
  });
});

describe("POST /api/partnerships (stub until admin-inbox stores it)", () => {
  const post = (headers: Record<string, string>) => partnershipRequest(new Request("https://x.test/api/partnerships", { method: "POST", body: "{}", headers }));

  it("answers 501 with the message the form shows", async () => {
    const res = await post({ "content-length": "2" });
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({ error: PARTNERSHIP_NOT_READY });
  });

  it("checks the size before anything else", async () => {
    expect((await post({ "content-length": String(17 * 1024) })).status).toBe(413);
    expect((await post({})).status).toBe(411);
  });
});
