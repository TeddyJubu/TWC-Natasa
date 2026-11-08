import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "./email";

const fetchMock = vi.fn();
const mail = { to: "rosa@x.test", subject: "Hello", text: "Open https://example.test/link" };

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CF_EMAIL_ACCOUNT_ID", "acct-123");
  vi.stubEnv("CF_EMAIL_API_TOKEN", "cf-secret-token");
  vi.stubEnv("EMAIL_FROM", "");
  vi.stubEnv("NODE_ENV", "production");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

describe("sendEmail", () => {
  it("posts one plain-text email to the Cloudflare Email Sending API", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, result: {} })));
    expect(await sendEmail(mail)).toEqual({ sent: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct-123/email/sending/send");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer cf-secret-token", "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({
      from: "info@thewomenscollective.club", to: ["rosa@x.test"], subject: "Hello", text: mail.text,
    });
  });

  it("uses EMAIL_FROM when set", async () => {
    vi.stubEnv("EMAIL_FROM", "hello@thewomenscollective.club");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })));
    await sendEmail(mail);
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).from).toBe("hello@thewomenscollective.club");
  });

  it("returns not-configured in production without the Cloudflare settings, sending and logging nothing", async () => {
    vi.stubEnv("CF_EMAIL_API_TOKEN", "");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await sendEmail(mail)).toEqual({ sent: false, reason: "not-configured" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("logs the whole email (with its link) to the console in development instead", async () => {
    vi.stubEnv("CF_EMAIL_ACCOUNT_ID", "");
    vi.stubEnv("NODE_ENV", "development");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await sendEmail(mail)).toEqual({ sent: false, reason: "not-configured" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join("\n")).toContain("https://example.test/link");
  });

  it("reports a Cloudflare or network failure as send-failed, never echoing secrets", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false, errors: [{ message: "cf-secret-token bad" }] }), { status: 400 }));
    const result = await sendEmail(mail);
    expect(result).toEqual({ sent: false, reason: "send-failed" });
    expect(JSON.stringify(result)).not.toContain("cf-secret-token");
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await sendEmail(mail)).toEqual({ sent: false, reason: "send-failed" });
  });
});
