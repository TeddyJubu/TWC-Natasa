// Secret guard: `.env` stays tracked because Lovable needs its VITE_ publishable values, so nothing
// tracked may ever hold a server secret. Real secrets go in `.dev.vars` (gitignored) or Wrangler secrets.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SECRET_NAMES = "SUPABASE_SERVICE_ROLE_KEY|LOVABLE_CRON_SECRET";
const PATTERNS: [string, RegExp][] = [
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{8,}/],
  // A value assigned to a secret name in any env/YAML/JSON/TOML/shell form (`KEY=v`, `KEY: v`, `"KEY": "v"`).
  // Not a value: empty, `$VAR`/`${VAR}`, `<placeholder>`, `process.env…` reads, `: string` type annotations.
  [
    "secret value",
    new RegExp(`(?:${SECRET_NAMES})["']?[ \\t]*[:=][ \\t]*["']?(?![\\s$<"'#]|process\\b|string\\b)[^\\s"'#$<]`),
  ],
];
const JWT = /eyJ[A-Za-z0-9_-]+=*\.(eyJ[A-Za-z0-9_-]+)=*\.[A-Za-z0-9_-]+/g;

/** Names of the secrets found in `text` (empty when clean). */
export function findSecrets(text: string): string[] {
  const found = PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
  for (const [, payload] of text.matchAll(JWT)) {
    try {
      if (JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role === "service_role") {
        found.push("service_role JWT");
      }
    } catch {
      // not a JWT payload
    }
  }
  return found;
}

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (payload: object) => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.c2lnbmF0dXJl`;
// Built at runtime so this file never contains a literal that trips the repo scan below.
const SB_SECRET = ["sb", "secret", "AbCdEf0123456789"].join("_");

describe("findSecrets", () => {
  it.each([
    ["sb_secret key", `SUPABASE_KEY=${SB_SECRET}`],
    ["service-role env line", ["SUPABASE_SERVICE_ROLE_KEY", "=abc"].join("")],
    ["exported cron secret", ["export LOVABLE_CRON_SECRET", '="hunter2"'].join("")],
    ["cron secret in JSON", `{"vars": {"${"LOVABLE_CRON_SECRET"}": "${"s3cr3t-value"}"}}`],
    ["service_role JWT", `KEY=${jwt({ iss: "supabase", role: "service_role" })}`],
    ["padded service_role JWT", `KEY=${jwt({ role: "service_role" }).replace(".", "=.")}`],
    ["unquoted YAML", "env:\n  " + "LOVABLE_CRON_SECRET" + ": abcdef123456"],
    ["inline assignment", "FOO=1 " + "LOVABLE_CRON_SECRET" + "=abc node server.js"],
    ["short JSON value", `{"${"LOVABLE_CRON_SECRET"}":"abc"}`],
  ])("flags %s", (_, text) => {
    expect(findSecrets(text)).not.toEqual([]);
  });

  it.each([
    ["publishable key", "VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_AbCdEf0123456789"],
    ["anon JWT", `VITE_SUPABASE_PUBLISHABLE_KEY=${jwt({ iss: "supabase", role: "anon" })}`],
    ["reading the env in code", "const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];"],
    ["an empty example entry", "# SUPABASE_SERVICE_ROLE_KEY=\nLOVABLE_CRON_SECRET="],
    ["an empty entry before another line", "LOVABLE_CRON_SECRET=\nVITE_SITE_URL=https://example.com"],
    ["prose naming the prefix", "Never commit an `sb_secret_` key."],
    ["forwarding a variable", "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}\nLOVABLE_CRON_SECRET=$CRON"],
    ["a placeholder", "LOVABLE_CRON_SECRET=<your secret>"],
    ["a type declaration", "interface Env { LOVABLE_CRON_SECRET: string; SUPABASE_SERVICE_ROLE_KEY?: string }"],
  ])("ignores %s", (_, text) => {
    expect(findSecrets(text)).toEqual([]);
  });
});

describe("tracked files", () => {
  it("contain no Supabase secret, service-role key or cron secret", () => {
    const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
    const files = [...new Set([".env", ...tracked])].filter((f) => existsSync(f));
    expect(files).toContain(".env");
    const hits = files.flatMap((f) => {
      const buf = readFileSync(f);
      if (buf.subarray(0, 8000).includes(0)) return []; // binary
      return findSecrets(buf.toString("utf8")).map((s) => `${f}: ${s}`);
    });
    expect(hits).toEqual([]);
  });
});
