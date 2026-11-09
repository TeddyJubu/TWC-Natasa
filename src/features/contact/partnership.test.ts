// /partnerships form check (client contract). Server storage is covered in contact.test.ts via inboxRequest.
import { describe, expect, it } from "vitest";
import { checkPartnership, COLLABORATIONS, PARTNERSHIP_LIMITS } from "./partnership";

const good = { name: " Rosa Diaz ", email: "rosa@x.test", business: "Rosa’s Ceramics", collaboration_type: "host", message: "A room.", consent: "on", honeypot: "" };

describe("checkPartnership (form)", () => {
  it("trims and returns the wire contract the form posts", () => {
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

  it("enforces the form limits and never trusts a non-string", () => {
    expect(checkPartnership({ ...good, message: "x".repeat(PARTNERSHIP_LIMITS.message + 1) })).toHaveProperty("errors.message");
    expect(checkPartnership({ ...good, name: 5 })).toHaveProperty("errors.name");
    expect(checkPartnership({ ...good, consent: "yes" })).toHaveProperty("errors.consent");
  });

  it("keeps a honeypot value so the server can drop the bot", () => {
    expect(checkPartnership({ ...good, honeypot: "spam" })).toHaveProperty("value.honeypot", "spam");
  });
});
