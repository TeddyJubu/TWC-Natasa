// The private-preview gate (site-pin.ts): off without SITE_PIN; otherwise every path but the icons and /healthz needs
// the PIN cookie, the PIN page returns her to where she was going, and the cookie never holds the PIN itself.
import { describe, expect, it } from "vitest";
import { PIN_COOKIE, PIN_PATH, pinGate } from "./site-pin";

const PIN = "test-pin";
const get = (path: string, headers: Record<string, string> = {}) => pinGate(new Request(`http://club.test${path}`, { headers }), PIN);
function submit(pin: string, next: string, headers: Record<string, string> = {}) {
  const body = new URLSearchParams({ pin, next }).toString();
  return pinGate(new Request(`http://club.test${PIN_PATH}`, {
    method: "POST", body,
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": String(body.length), "cf-connecting-ip": "203.0.113.9", ...headers },
  }), PIN);
}
async function signedCookie() {
  const res = (await submit(PIN, "/", { "cf-connecting-ip": "203.0.113.1" }))!;
  return res.headers.get("Set-Cookie")!.split(";")[0];
}

describe("pinGate", () => {
  it("lets everything through while no PIN is set", async () => {
    expect(await pinGate(new Request("http://club.test/account"), undefined)).toBeNull();
    expect(await pinGate(new Request("http://club.test/account"), "")).toBeNull();
  });

  it("answers every page, API call, upload and asset with the PIN page, but not the icons or the health check", async () => {
    for (const path of ["/", "/account", "/feed?x=1", "/media/avatars/a/b.png", "/assets/app.js", "/robots.txt", "/llms.txt", "/llms-full.txt", "/sitemap.xml"]) {
      const res = (await get(path))!;
      expect(res.status).toBe(401);
      expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    }
    const post = await pinGate(new Request("http://club.test/api/contact", { method: "POST", body: "{}" }), PIN);
    expect(post!.status).toBe(401);
    for (const path of ["/favicon.ico", "/favicon.png", "/apple-touch-icon.png", "/healthz"]) expect(await get(path)).toBeNull();
  });

  it("remembers where she was going, escaped", async () => {
    const html = await (await get('/members/rosa-12?a="b"&c=<d>'))!.text();
    expect(html).toContain(`action="${PIN_PATH}"`);
    // The URL parser percent-encodes quotes and brackets; what's left to escape (&) is escaped.
    expect(html).toContain('name="next" value="/members/rosa-12?a=%22b%22&#38;c=%3Cd%3E"');
  });

  it("refuses a wrong PIN and lets the right one in, with a hashed cookie that opens every page", async () => {
    const wrong = (await submit("nope", "/feed"))!;
    expect(wrong.status).toBe(401);
    expect(await wrong.text()).toContain("That PIN isn’t right.");
    const right = (await submit(` ${PIN} `, "/feed", { "x-forwarded-proto": "https" }))!;
    expect(right.status).toBe(303);
    expect(right.headers.get("Location")).toBe("/feed");
    const cookie = right.headers.get("Set-Cookie")!;
    expect(cookie).toMatch(new RegExp(`^${PIN_COOKIE}=[0-9a-f]{64}; Path=/; Max-Age=\\d+; HttpOnly; SameSite=Lax; Secure$`));
    expect(cookie).not.toContain(PIN);
    expect(await get("/feed", { cookie: `other=1; ${cookie.split(";")[0]}` })).toBeNull();
    expect((await get("/feed", { cookie: `${PIN_COOKIE}=${"0".repeat(64)}` }))!.status).toBe(401);
  });

  it("sends her back only to a path on this site", async () => {
    for (const next of ["//evil.example/x", "/\\evil.example", "https://evil.example", "javascript:alert(1)", `${PIN_PATH}?x`]) {
      expect((await submit(PIN, next, { "cf-connecting-ip": "203.0.113.2" }))!.headers.get("Location")).toBe("/");
    }
  });

  it("no longer opens with a cookie from an old PIN", async () => {
    const cookie = await signedCookie();
    expect(await pinGate(new Request("http://club.test/", { headers: { cookie } }), "a-new-pin")).not.toBeNull();
  });

  it("refuses an oversized form, and slows down guessing after ten tries", async () => {
    const big = await pinGate(new Request(`http://club.test${PIN_PATH}`, { method: "POST", body: "x", headers: { "Content-Length": "999999" } }), PIN);
    expect(big!.status).toBe(413);
    const ip = { "cf-connecting-ip": "198.51.100.7" };
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await submit("guess", "/", ip))!.status);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
