import { extractBearerToken, verifyJwtHmac, type AuthFn } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

// Only the app can reach Eve: it signs a five-minute token for the admin it has just checked. That admin's id (`sub`)
// becomes the conversation's principal, which is the identity Eve's tools act for when they call the app.
function appAdmin(): AuthFn<Request> {
  return async (request) => {
    const token = extractBearerToken(request.headers.get("authorization"));
    const result = await verifyJwtHmac(token, {
      algorithm: "HS256",
      issuer: "twc-app",
      audiences: ["twc-eve"],
      secret: process.env.EVE_SHARED_SECRET ?? "",
    });
    if (!result.ok || !token) return null;
    const { sub } = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as { sub?: unknown };
    if (typeof sub !== "string" || !sub) return null;
    return { ...result.sessionAuth, authenticator: "twc-app", principalId: sub, principalType: "user" };
  };
}

export default eveChannel({ auth: appAdmin() });
