// Server-only: Better Auth on the app's SQLite database. Served at /api/auth/* (src/routes/api/auth/$.ts);
// server functions read the session through src/server/context.server.ts.
import { betterAuth } from "better-auth";
import { getDb, type DB } from "./db";
import { appUrl, sendEmail } from "./email";
import { authSecret } from "./secret";

const env = (name: string) => process.env[name] || undefined;

const verificationText = (url: string) => `Welcome to The Women’s Collective!

Confirm your email address to finish creating your account:
${url}

If you didn’t sign up, you can ignore this email.
`;

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
    rateLimit: { enabled: true },
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
        void sendEmail({ to: user.email, subject: "Confirm your email", text: verificationText(url) });
      },
    },
    socialProviders: googleId && googleSecret ? { google: { clientId: googleId, clientSecret: googleSecret } } : {},
  });
}

let shared: ReturnType<typeof createAuth> | undefined;
export const getAuth = () => (shared ??= createAuth(getDb()));
