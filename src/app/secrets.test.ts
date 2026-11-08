// Secret guard: `.env` stays tracked because the server builds `main` with its public VITE_ values, so nothing
// tracked may ever hold a server secret. Real secrets go in the server's environment or .env.local (gitignored).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SECRET_NAMES = "BETTER_AUTH_SECRET|CF_EMAIL_API_TOKEN|GOOGLE_CLIENT_SECRET";
// A value assigned to a secret name in any env/YAML/JSON/TOML/shell form (`KEY=v`, `KEY: v`, `"KEY": "v"`).
// Not a value: empty, `$VAR`/`${VAR}`, `<placeholder>`, `process.env…` reads, `: string` type annotations, a comment.
const SECRET_VALUE = new RegExp(`(?:${SECRET_NAMES})["']?[ \\t]*[:=][ \\t]*["']?(?![\\s$<"'#]|process\\b|string\\b)[^\\s"'#$<]`);

/** True when `text` assigns a value to a server secret. */
export const hasSecret = (text: string) => SECRET_VALUE.test(text);

// Names built at runtime so this file never contains a literal that trips the repo scan below; it is scanned too.
const [AUTH, EMAIL, GOOGLE] = SECRET_NAMES.split("|");

describe("hasSecret", () => {
  it.each([
    ["an env line", `${AUTH}=abc`],
    ["an exported value", `export ${EMAIL}="hunter2"`],
    ["a JSON value", `{"vars": {"${GOOGLE}": "s3cr3t-value"}}`],
    ["unquoted YAML", `env:\n  ${EMAIL}: abcdef123456`],
    ["an inline assignment", `FOO=1 ${AUTH}=abc node server.mjs`],
    ["a short JSON value", `{"${GOOGLE}":"abc"}`],
  ])("flags %s", (_, text) => expect(hasSecret(text)).toBe(true));

  it.each([
    ["reading the env in code", `const secret = process.env['${AUTH}'];`],
    ["empty example entries", `# ${AUTH}=\n${EMAIL}=`],
    ["an empty entry before another line", `${EMAIL}=\nVITE_SITE_URL=https://example.com`],
    ["forwarding a variable", `${AUTH}=\${${AUTH}}\n${EMAIL}=$EMAIL`],
    ["a placeholder", `${GOOGLE}=<your secret>`],
    ["a type declaration", `interface Env { ${EMAIL}: string; ${AUTH}?: string }`],
    ["a commented-out example with no value", `# ${GOOGLE}=                      # secret`],
  ])("ignores %s", (_, text) => expect(hasSecret(text)).toBe(false));
});

describe("tracked files", () => {
  it("contain no server secret", () => {
    // Tracked plus new not-yet-ignored files, so a secret fails before it's committed (.env.local is ignored).
    const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
      .split("\0")
      .filter((f) => f && existsSync(f));
    expect(files).toContain(".env");
    const hits = files.filter((f) => {
      const buf = readFileSync(f);
      return !buf.subarray(0, 8000).includes(0) && hasSecret(buf.toString("utf8"));
    });
    expect(hits).toEqual([]);
  });

  it(".env holds only public VITE_ values", () => {
    const names = readFileSync(".env", "utf8").split("\n").filter((l) => /^\s*[A-Z_]+=/.test(l)).map((l) => l.split("=")[0].trim());
    expect(names.filter((n) => !n.startsWith("VITE_"))).toEqual([]);
    expect(names.filter((n) => /SUPABASE/.test(n))).toEqual([]);
  });
});
