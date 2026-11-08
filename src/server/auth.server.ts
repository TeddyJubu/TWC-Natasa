// Server-only: Better Auth on the app's SQLite database. Served at /api/auth/* (src/routes/api/auth/$.ts);
// server functions read the session through src/server/context.server.ts.
import { betterAuth } from "better-auth";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import bcrypt from "bcryptjs";
import { getDb, type DB } from "./db";
import { appUrl, sendEmail } from "./email";

const env = (name: string) => process.env[name] || undefined;

/** Supabase stored bcrypt (`$2a$…`/`$2b$…`); everything new is Better Auth's own scrypt hash. */
const verify = ({ hash, password }: { hash: string; password: string }) =>
  hash.startsWith("$2") ? bcrypt.compare(password, hash) : verifyPassword({ hash, password });

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
    secret: env("BETTER_AUTH_SECRET"),
    trustedOrigins: production ? [base] : [base, "http://localhost:8080"],
    // UUIDs, so ids imported from Supabase and new ones look alike.
    advanced: { database: { generateId: "uuid" } },
    // In-memory counters: one server process. Behind Caddy the client IP comes from X-Forwarded-For.
    rateLimit: { enabled: true },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      revokeSessionsOnPasswordReset: true,
      password: { hash: hashPassword, verify },
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
