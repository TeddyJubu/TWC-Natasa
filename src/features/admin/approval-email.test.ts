import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fake, fakeClient } from "@/test/fake-supabase";

const createClient = vi.fn((..._args: unknown[]) => fakeClient);
vi.mock("@supabase/supabase-js", () => ({ createClient: (...args: unknown[]) => createClient(...args) }));

import { sendApprovalEmail } from "./approval-email.server";

const fetchMock = vi.fn();
const input = { accessToken: "user.jwt.token", applicationId: "app-1" };
const admin = { data: true, error: null };
const approved = { data: { email: "rosa@x.test", full_name: "Rosa Diaz", status: "approved" }, error: null };

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CF_EMAIL_ACCOUNT_ID", "acct-123");
  vi.stubEnv("CF_EMAIL_API_TOKEN", "cf-secret-token");
  vi.stubEnv("EMAIL_FROM", "");
  vi.stubEnv("VITE_SITE_URL", "https://thewomenscollective.club");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
  createClient.mockClear();
  fake.reset();
});

describe("sendApprovalEmail", () => {
  it("builds the Supabase client with the caller's bearer token", async () => {
    fake.results = [{ data: false, error: null }];
    await sendApprovalEmail(input);
    const options = createClient.mock.calls[0][2] as { global: { headers: Record<string, string> } };
    expect(options.global.headers.Authorization).toBe("Bearer user.jwt.token");
  });

  it("refuses a caller who isn't an admin, before reading or sending anything", async () => {
    fake.results = [{ data: false, error: null }];
    expect(await sendApprovalEmail(input)).toEqual({ sent: false, reason: "not-admin" });
    expect(fake.calls).toEqual([["rpc", "is_admin"]]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses when is_admin errors (e.g. an expired token)", async () => {
    fake.results = [{ data: null, error: { message: "JWT expired" } }];
    expect(await sendApprovalEmail(input)).toEqual({ sent: false, reason: "not-admin" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an application that isn't approved", async () => {
    fake.results = [admin, { data: { ...approved.data, status: "declined" }, error: null }];
    expect(await sendApprovalEmail(input)).toEqual({ sent: false, reason: "not-approved" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a missing application", async () => {
    fake.results = [admin, { data: null, error: null }];
    expect(await sendApprovalEmail(input)).toEqual({ sent: false, reason: "not-approved" });
  });

  it("returns not-configured without the Cloudflare settings, and never leaks the token", async () => {
    vi.stubEnv("CF_EMAIL_API_TOKEN", "");
    fake.results = [admin, approved];
    const result = await sendApprovalEmail(input);
    expect(result).toEqual({ sent: false, reason: "not-configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends one plain-text welcome email with the exact request", async () => {
    fake.results = [admin, approved];
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, result: {} })));
    expect(await sendApprovalEmail(input)).toEqual({ sent: true });

    expect(fake.calls).toEqual([
      ["rpc", "is_admin"],
      ["from", "applications"],
      ["select", "email, full_name, status"],
      ["eq", "id", "app-1"],
      ["maybeSingle"],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct-123/email/sending/send");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer cf-secret-token", "Content-Type": "application/json" });
    const body = JSON.parse(init.body as string);
    expect(Object.keys(body).sort()).toEqual(["from", "subject", "text", "to"]);
    expect(body.from).toBe("info@thewomenscollective.club");
    expect(body.to).toEqual(["rosa@x.test"]);
    expect(body.subject).toBe("Welcome to The Women’s Collective");
    expect(body.text).toContain("Dear Rosa Diaz,");
    expect(body.text).toContain("https://thewomenscollective.club/auth");
  });

  it("uses EMAIL_FROM when set", async () => {
    vi.stubEnv("EMAIL_FROM", "hello@thewomenscollective.club");
    fake.results = [admin, approved];
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })));
    await sendApprovalEmail(input);
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).from).toBe("hello@thewomenscollective.club");
  });

  it("reports a Cloudflare failure without echoing secrets", async () => {
    fake.results = [admin, approved];
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false, errors: [{ message: "cf-secret-token bad" }] }), { status: 400 }));
    const result = await sendApprovalEmail(input);
    expect(result).toEqual({ sent: false, reason: "send-failed" });
    expect(JSON.stringify(result)).not.toContain("cf-secret-token");
  });

  it("reports a network failure as send-failed", async () => {
    fake.results = [admin, approved];
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await sendApprovalEmail(input)).toEqual({ sent: false, reason: "send-failed" });
  });
});
