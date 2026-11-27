// The email-only newsletter sign-up: the shared check and POST /api/newsletter (size, per-IP limit, consent,
// honeypot, the same answer for a new and a known address, and Beehiiv only through subscribeIfConsented()).
// Beehiiv is a stubbed fetch: nothing leaves the machine.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "@/server/db";
import { checkSignup, SIGNUP_ERRORS } from "./schema";
import { newsletterRequest } from "./newsletter.server";

let db: DB;
let fetchMock: ReturnType<typeof vi.fn>;
const ctx = () => ({ db, actor: null });
const rows = () => db.prepare("select email, source, consent from newsletter_subscribers order by email").all();
const good = { email: "Rosa@X.test ", consent: true, honeypot: "" };

beforeEach(() => {
  db = openDb(":memory:");
  vi.stubEnv("BEEHIIV_API_KEY", "test-key-not-a-secret");
  vi.stubEnv("BEEHIIV_PUBLICATION_ID", "pub_test-1");
  fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A JSON POST whose body records whether anything read it. */
function post(body: string, headers: Record<string, string> = {}) {
  const state = { read: false };
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      state.read = true;
      controller.enqueue(bytes);
      controller.close();
    },
  }, { highWaterMark: 0 });
  const request = new Request("http://club.test/api/newsletter", {
    method: "POST", body: stream, duplex: "half",
    headers: { "Content-Type": "application/json", "Content-Length": String(bytes.byteLength), ...headers },
  } as RequestInit);
  return { request, state };
}
const send = (ip: string, body: unknown = good) => newsletterRequest(ctx(), post(JSON.stringify(body), { "cf-connecting-ip": ip }).request);
const sentBodies = () => fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string) as Record<string, unknown>);

describe("checkSignup", () => {
  it("trims a good sign-up", () => {
    expect(checkSignup({ email: " rosa@x.test ", consent: true })).toEqual({ value: { email: "rosa@x.test", consent: true } });
  });

  it("names each problem", () => {
    expect(checkSignup({})).toEqual({ errors: { email: SIGNUP_ERRORS.email, consent: SIGNUP_ERRORS.consent } });
    expect(checkSignup({ email: "nope", consent: true })).toEqual({ errors: { email: SIGNUP_ERRORS.emailShape } });
    expect(checkSignup({ email: `${"a".repeat(250)}@x.test`, consent: true })).toEqual({ errors: { email: SIGNUP_ERRORS.emailShape } });
  });

  it.each([undefined, null, false, 0, 1, "on", "true", "yes"])("takes only an explicit true as consent, not %j", (consent) => {
    expect(checkSignup({ email: "rosa@x.test", consent })).toEqual({ errors: { consent: SIGNUP_ERRORS.consent } });
  });
});

describe("POST /api/newsletter", () => {
  it("subscribes a new address through Beehiiv once, records it, and answers 204", async () => {
    expect((await send("192.0.2.1")).status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBodies()[0]).toMatchObject({ email: "rosa@x.test", reactivate_existing: false, utm_medium: "website", utm_campaign: "newsletter-signup" });
    expect(rows()).toEqual([{ email: "rosa@x.test", source: "website", consent: 1 }]);
  });

  it("answers a known address with the same 204, sending nothing and changing nothing", async () => {
    db.prepare("insert into newsletter_subscribers (legacy_id, email, source, consent) values ('newsletter-1', 'old@x.test', 'beehiiv', null)").run();
    db.prepare("insert into newsletter_subscribers (email, source, consent) values ('left@x.test', 'website', 0)").run();
    for (const email of ["old@x.test", "OLD@x.test", "left@x.test"]) {
      const res = await send("192.0.2.2", { ...good, email });
      expect([res.status, await res.text()]).toEqual([204, ""]);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rows()).toEqual([
      { email: "left@x.test", source: "website", consent: 0 },
      { email: "old@x.test", source: "beehiiv", consent: null },
    ]);
  });

  it("refuses a sign-up without an explicit tick, storing and sending nothing", async () => {
    for (const consent of [false, "on", 1, undefined]) {
      const res = await send("192.0.2.3", { ...good, consent });
      expect([res.status, (await res.json()).error]).toEqual([400, SIGNUP_ERRORS.consent]);
    }
    expect([rows(), fetchMock.mock.calls]).toEqual([[], []]);
  });

  it("answers a filled honeypot with the same success, storing and sending nothing", async () => {
    for (const honeypot of ["http://spam.test", " ", 1, true]) expect((await send("192.0.2.4", { ...good, honeypot })).status).toBe(204);
    expect((await send("192.0.2.4", { email: "nope", honeypot: "x" })).status).toBe(204);
    expect([rows(), fetchMock.mock.calls]).toEqual([[], []]);
  });

  it("refuses an invalid email or a malformed body with 400 and sends nothing", async () => {
    const invalid = await send("192.0.2.5", { ...good, email: "rosa at x" });
    expect([invalid.status, (await invalid.json()).error]).toEqual([400, SIGNUP_ERRORS.emailShape]);
    expect((await send("192.0.2.5", { ...good, email: "" })).status).toBe(400);
    expect((await send("192.0.2.5", [good])).status).toBe(400);
    expect((await newsletterRequest(ctx(), post("{not json", { "cf-connecting-ip": "192.0.2.5" }).request)).status).toBe(400);
    expect([rows(), fetchMock.mock.calls]).toEqual([[], []]);
  });

  it("refuses a body over 2 KB, or of unknown size, before reading it", async () => {
    const big = post("{}", { "Content-Length": String(2 * 1024 + 1), "cf-connecting-ip": "192.0.2.6" });
    expect((await newsletterRequest(ctx(), big.request)).status).toBe(413);
    expect(big.state.read).toBe(false);
    const unsized = new Request("http://club.test/api/newsletter", { method: "POST" });
    expect((await newsletterRequest(ctx(), unsized)).status).toBe(411);
  });

  it("allows 5 per client IP per 10 minutes, then 429 without reading the body", async () => {
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await send("192.0.2.7", { ...good, email: `p${i}@x.test` })).status);
    expect(statuses).toEqual([204, 204, 204, 204, 204]);
    const sixth = post(JSON.stringify(good), { "cf-connecting-ip": "192.0.2.7" });
    expect((await newsletterRequest(ctx(), sixth.request)).status).toBe(429);
    expect(sixth.state.read).toBe(false);
    expect((await send("192.0.2.8")).status).toBe(204);
  });

  it("answers 503 when Beehiiv fails or isn't set up, keeping no claim, and logs no address", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    const failed = await send("192.0.2.9");
    expect([failed.status, (await failed.json()).error]).toEqual([503, "We couldn’t add you just now. Please try again in a little while."]);
    expect(rows()).toEqual([]);
    vi.stubEnv("BEEHIIV_API_KEY", "");
    expect((await send("192.0.2.9")).status).toBe(503);
    expect(rows()).toEqual([]);
    expect(warn.mock.calls.flat().join(" ")).not.toContain("rosa");
  });
});
