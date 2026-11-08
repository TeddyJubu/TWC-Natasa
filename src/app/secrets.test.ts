// Secret guard: `.env` stays tracked because the server builds `main` with its VITE_ publishable values,
// so nothing tracked may ever hold a server secret. Real secrets go in `.dev.vars` (gitignored) or Wrangler secrets.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SECRET_NAMES = "SUPABASE_SERVICE_ROLE_KEY|CF_EMAIL_API_TOKEN|DATABASE_URL";
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
// Fixtures are built at runtime (names via ROLE/EMAIL) so this file never contains a literal that trips
// the repo scan below; this file is itself scanned.
const SB_SECRET = ["sb", "secret", "AbCdEf0123456789"].join("_");
const [ROLE, EMAIL] = SECRET_NAMES.split("|");

describe("findSecrets", () => {
  it.each([
    ["sb_secret key", `SUPABASE_KEY=${SB_SECRET}`],
    ["service-role env line", `${ROLE}=abc`],
    ["exported email token", `export ${EMAIL}="hunter2"`],
    ["email token in JSON", `{"vars": {"${EMAIL}": "s3cr3t-value"}}`],
    ["service_role JWT", `KEY=${jwt({ iss: "supabase", role: "service_role" })}`],
    ["padded service_role JWT", `KEY=${jwt({ role: "service_role" }).replace(".", "=.")}`],
    ["unquoted YAML", `env:\n  ${EMAIL}: abcdef123456`],
    ["inline assignment", `FOO=1 ${EMAIL}=abc node server.js`],
    ["short JSON value", `{"${EMAIL}":"abc"}`],
  ])("flags %s", (_, text) => {
    expect(findSecrets(text)).not.toEqual([]);
  });

  it.each([
    ["publishable key", "VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_AbCdEf0123456789"],
    ["anon JWT", `VITE_SUPABASE_PUBLISHABLE_KEY=${jwt({ iss: "supabase", role: "anon" })}`],
    ["reading the env in code", `const ${ROLE} = process.env['${ROLE}'];`],
    ["an empty example entry", `# ${ROLE}=\n${EMAIL}=`],
    ["an empty entry before another line", `${EMAIL}=\nVITE_SITE_URL=https://example.com`],
    ["prose naming the prefix", "Never commit an `sb_secret_` key."],
    ["forwarding a variable", `${ROLE}=\${${ROLE}}\n${EMAIL}=$EMAIL`],
    ["a placeholder", `${EMAIL}=<your secret>`],
    ["a type declaration", `interface Env { ${EMAIL}: string; ${ROLE}?: string }`],
  ])("ignores %s", (_, text) => {
    expect(findSecrets(text)).toEqual([]);
  });
});

describe("tracked files", () => {
  it("contain no Supabase secret, service-role key or email API token", () => {
    // Tracked plus new not-yet-ignored files, so a secret fails before it's committed (.dev.vars is ignored).
    const tracked = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      encoding: "utf8",
    })
      .split("\0")
      .filter(Boolean);
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
