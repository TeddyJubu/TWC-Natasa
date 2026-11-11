// Server-only: Better Auth on the app's SQLite database. Served at /api/auth/* (src/routes/api/auth/$.ts);
// server functions read the session through src/server/context.server.ts.
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { afterAccountDelete, beforeAccountDelete, hasPassword } from "./account-delete";
import { getDb, type DB } from "./db";
import { appUrl, sendEmail } from "./email";
import { authSecret } from "./secret";

const env = (name: string) => process.env[name] || undefined;

const verificationText = (url: string) => `Welcome to The Women’s Collective!

Confirm your email address to finish creating your account:
${url}

If you didn’t sign up, you can ignore this email.
`;

// Every confirmation link lands on /verified, whichever flow sent it (sign-up, an unverified sign-in, a resend):
// the sign-in call can't carry a callbackURL, since Better Auth would redirect a successful sign-in there too.
// Better Auth appends ?error=TOKEN_EXPIRED|INVALID_TOKEN|… to it when the link fails.
function toVerifiedPage(url: string) {
  const link = new URL(url);
  link.searchParams.set("callbackURL", "/verified");
  return link.toString();
}

const resetText = (url: string) => `Someone asked to reset the password for your Women’s Collective account.

Choose a new password here (the link expires in an hour):
${url}

If it wasn’t you, ignore this email; your password stays the same.
`;

export function createAuth(db: DB) {
  const base = appUrl();
  const production = env("NODE_ENV") === "production";
  const googleId = env("GOOGLE_CLIENT_ID");
  const googleSecret = env("GOOGLE_CLIENT_SECRET");
  return betterAuth({
    database: db,
    baseURL: base,
    secret: authSecret(),
    trustedOrigins: production ? [base] : [base, "http://localhost:8080"],
    advanced: {
      // UUIDs, so ids imported from Supabase and new ones look alike.
      database: { generateId: "uuid" },
      // Behind Cloudflare → Caddy the socket address is Caddy's and x-forwarded-for carries Cloudflare's edge, so
      // the visitor is cf-connecting-ip; x-forwarded-for (single value) only without Cloudflare.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
    },
    // ponytail: in-memory counters, one server process; use Better Auth's database storage if that changes.
    // Per client IP: 20 password sign-ins and 10 sign-ups per 10 minutes, not the default 3 per 10 s (~1,000 an hour).
    // Room for a gathering on one venue Wi-Fi (one cf-connecting-ip); the page shows a 429 as a failed sign-in.
    rateLimit: {
      enabled: true,
      // /delete-user checks her password, so it can't be a faster password oracle than sign-in.
      customRules: { "/sign-in/email": { window: 600, max: 20 }, "/sign-up/email": { window: 600, max: 10 }, "/delete-user": { window: 600, max: 5 } },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        void sendEmail({ to: user.email, subject: "Reset your password", text: resetText(url) });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      // Verifying flips user.emailVerified; the user_verified trigger (0001_init.sql) then links applications.
      sendVerificationEmail: async ({ user, url }) => {
        void sendEmail({ to: user.email, subject: "Confirm your email", text: verificationText(toVerifiedPage(url)) });
      },
    },
    socialProviders: googleId && googleSecret ? { google: { clientId: googleId, clientSecret: googleSecret } } : {},
    // "Delete my account" on /account. A password account must re-enter its password (Better Auth checks it); a
    // Google-only one has none, so Better Auth's fresh-session rule applies (signed in within the last day).
    // No emailed confirmation, so no deletion tokens either. Admins are refused in beforeDelete.
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => beforeAccountDelete(db, user),
        afterDelete: async (user) => afterAccountDelete(user),
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/delete-user") return;
        const body = (ctx.body ?? {}) as { password?: unknown; token?: unknown };
        if (body.token !== undefined) throw new APIError("BAD_REQUEST", { code: "TOKEN_NOT_SUPPORTED", message: "Deletion links aren’t used here." });
        if (typeof body.password === "string" && body.password) return;
        const session = await getSessionFromCtx(ctx);
        if (session && hasPassword(db, session.user.id)) {
          throw new APIError("BAD_REQUEST", { code: "PASSWORD_REQUIRED", message: "Enter your password to delete your account." });
        }
      }),
    },
  });
}

let shared: ReturnType<typeof createAuth> | undefined;
export const getAuth = () => (shared ??= createAuth(getDb()));
