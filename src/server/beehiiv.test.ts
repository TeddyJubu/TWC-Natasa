// The Beehiiv consent gate (FIX-IN-REBUILD CRM-182, OPS-450/520/521): nothing is sent without an explicit tick, nothing is
// sent twice, the imported list (consent null) is never replayed, and the application path needs BOTH of its answers.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type DB } from "./db";
import { subscribeIfConsented, type Optin } from "./beehiiv";
import { newsletterConsent, optInApplicant, submitApplication } from "@/features/applications/applications.server";

const utm = { source: "nbwc.site", medium: "membership", campaign: "membership-optin" };
const optin = (extra: Partial<Optin> = {}): Optin => ({ email: "Rosa@X.test ", name: "Rosa Diaz", consent: true, utm, ...extra });
let db: DB;
let fetchMock: ReturnType<typeof vi.fn>;
const rows = () => db.prepare("select email, source, consent from newsletter_subscribers order by email").all();

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
});

describe("subscribeIfConsented", () => {
  it("subscribes once with explicit consent: normalised address, no reactivation, double opt-in, and records it", async () => {
    expect(await subscribeIfConsented(db, optin())).toEqual({ subscribed: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.beehiiv.com/v2/publications/pub_test-1/subscriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key-not-a-secret");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "rosa@x.test", reactivate_existing: false, send_welcome_email: true, double_opt_override: "on",
      utm_source: "nbwc.site", utm_medium: "membership", utm_campaign: "membership-optin",
    });
    expect(rows()).toEqual([{ email: "rosa@x.test", source: "website", consent: 1 }]);
  });

  it.each([undefined, null, false, 0, 1, "yes", "true", "on"])("never subscribes on consent %j", async (consent) => {
    expect(await subscribeIfConsented(db, optin({ consent }))).toEqual({ subscribed: false, reason: "no-consent" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rows()).toEqual([]);
  });

  it("never subscribes an address that is already on the list — imported Beehiiv rows (consent null) and explicit no's included", async () => {
    db.prepare("insert into newsletter_subscribers (legacy_id, email, source, consent) values ('newsletter-1', 'old@x.test', 'beehiiv', null)").run();
    db.prepare("insert into newsletter_subscribers (email, source, consent) values ('no@x.test', 'website', 0)").run();
    db.prepare("insert into newsletter_subscribers (email, source, consent) values ('yes@x.test', 'website', 1)").run();
    for (const email of ["old@x.test", "OLD@x.test", "no@x.test", "yes@x.test"]) {
      expect(await subscribeIfConsented(db, optin({ email }))).toEqual({ subscribed: false, reason: "already-known" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rows()).toEqual([
      { email: "no@x.test", source: "website", consent: 0 },
      { email: "old@x.test", source: "beehiiv", consent: null },
      { email: "yes@x.test", source: "website", consent: 1 },
    ]);
  });

  it("replaying the same opt-in sends nothing the second time", async () => {
    await subscribeIfConsented(db, optin());
    expect(await subscribeIfConsented(db, optin())).toEqual({ subscribed: false, reason: "already-known" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("two racing sends for one address make one call", async () => {
    const both = await Promise.all([subscribeIfConsented(db, optin()), subscribeIfConsented(db, optin())]);
    expect(both.filter((r) => r.subscribed)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is not configured without a valid key and publication id: nothing sent, nothing recorded", async () => {
    for (const [key, publication] of [[undefined, "pub"], ["test-key-not-a-secret", undefined], ["short", "pub"], ["test-key-not-a-secret", "bad id!"]]) {
      vi.stubEnv("BEEHIIV_API_KEY", key ?? "");
      vi.stubEnv("BEEHIIV_PUBLICATION_ID", publication ?? "");
      expect(await subscribeIfConsented(db, optin())).toEqual({ subscribed: false, reason: "not-configured" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rows()).toEqual([]);
  });

  it("rejects a bad address before any call", async () => {
    for (const email of ["", "nobody", "a@b", "a@@b.co", `${"a".repeat(250)}@x.test`]) {
      expect(await subscribeIfConsented(db, optin({ email }))).toEqual({ subscribed: false, reason: "invalid-email" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a Beehiiv refusal or a network error releases the claim, so a later opt-in can retry, and leaks no detail", async () => {
    fetchMock.mockResolvedValueOnce(new Response("secret upstream text", { status: 500 }));
    expect(await subscribeIfConsented(db, optin())).toEqual({ subscribed: false, reason: "send-failed" });
    fetchMock.mockRejectedValueOnce(new Error("boom"));
    expect(await subscribeIfConsented(db, optin())).toEqual({ subscribed: false, reason: "send-failed" });
    expect(rows()).toEqual([]);
    expect(await subscribeIfConsented(db, optin())).toEqual({ subscribed: true });
    expect(rows()).toHaveLength(1);
  });
});

describe("newsletterConsent (applications)", () => {
  it("needs the newsletter yes AND the email consent", () => {
    expect(newsletterConsent({ newsletter: { subscribe: true, emailConsent: true } })).toBe(true);
    expect(newsletterConsent({ newsletter: { subscribe: true } })).toBe(false);
    expect(newsletterConsent({ newsletter: { subscribe: true, emailConsent: false } })).toBe(false);
    expect(newsletterConsent({ newsletter: { subscribe: false, emailConsent: true } })).toBe(false);
    expect(newsletterConsent({ newsletter: { subscribe: "true", emailConsent: "true" } })).toBe(false);
    expect(newsletterConsent({})).toBe(false);
  });

  it("reads the imported legacy shape with the same two-answer rule", () => {
    expect(newsletterConsent({ newsletter: "yes", email_subscription_consent: "yes" })).toBe(true);
    expect(newsletterConsent({ newsletter: "yes" })).toBe(false); // the legacy bug: newsletter alone subscribed
    expect(newsletterConsent({ newsletter: "yes", email_subscription_consent: "no" })).toBe(false);
    expect(newsletterConsent({ newsletter: "no", email_subscription_consent: "yes" })).toBe(false);
  });
});

describe("applying", () => {
  const apply = (answers: Record<string, unknown>, email = "new@x.test") => optInApplicant(db, submitApplication({ db, actor: null }, { email, fullName: "New", answers }));

  it("subscribes the applicant who opted in, and only that applicant", async () => {
    await apply({ newsletter: { subscribe: true, emailConsent: true } });
    await apply({ newsletter: { subscribe: false } }, "no@x.test");
    await apply({ newsletter: { subscribe: true } }, "half@x.test");
    await apply({}, "silent@x.test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string).email).toBe("new@x.test");
    expect(db.prepare("select count(*) as n from applications").get()).toEqual({ n: 4 });
  });

  it("keeps the application when Beehiiv throws", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    await expect(apply({ newsletter: { subscribe: true, emailConsent: true } })).resolves.toBeUndefined();
    expect(db.prepare("select count(*) as n from applications").get()).toEqual({ n: 1 });
  });

  it("an applicant already on the imported list is not re-sent", async () => {
    db.prepare("insert into newsletter_subscribers (legacy_id, email, source, consent) values ('newsletter-9', 'new@x.test', 'beehiiv', null)").run();
    await apply({ newsletter: { subscribe: true, emailConsent: true } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
