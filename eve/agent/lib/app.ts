import { createHmac } from "node:crypto";

const b64 = (value: string) => Buffer.from(value).toString("base64url");

/** A one-minute token naming the admin in this conversation. The app checks she is still an admin on every call. */
function toolToken(adminId: string): string {
  const secret = process.env.EVE_SHARED_SECRET ?? "";
  if (secret.length < 32) throw new Error("EVE_SHARED_SECRET is not set.");
  const iat = Math.floor(Date.now() / 1000);
  const body = `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(JSON.stringify({ iss: "twc-app", aud: "twc-eve-tools", sub: adminId, iat, exp: iat + 60 }))}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}

type ToolContext = { session: { auth: { current?: { principalId?: string } | null } }; abortSignal?: AbortSignal };

export async function callApp(ctx: ToolContext, body: Record<string, unknown>): Promise<unknown> {
  const adminId = ctx.session.auth.current?.principalId;
  if (!adminId) throw new Error("No signed-in admin for this conversation.");
  const base = (process.env.TWC_APP_URL || "http://127.0.0.1:8788").replace(/\/+$/, "");
  const response = await fetch(`${base}/api/eve-tools`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${toolToken(adminId)}` },
    body: JSON.stringify(body),
    signal: ctx.abortSignal,
  });
  const result = await response.json().catch(() => null) as { error?: unknown } | null;
  if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : `The app answered ${response.status}.`);
  return result;
}
