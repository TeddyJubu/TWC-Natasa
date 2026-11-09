// The CRM custom-forms import (scripts/import-forms.ts) on an in-memory database, with the made-up CRM dump and
// submissions in scripts/fixtures/: counts, choices, conversions, skipped forms, old-name redirects, idempotency.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type DB } from "@/server/db";
import { readRows } from "@/server/legacy-import";
import { formRequest, openForm } from "./forms.server";
import { htmlToText, importForms, readCrmDb, readPublished, type CrmDump, type ImportInput } from "./import.server";
import type { Question } from "./schema";

const crm = (): CrmDump => JSON.parse(readFileSync("scripts/fixtures/crm-forms.json", "utf8")) as CrmDump;
const submissions = () => readRows("scripts/fixtures/forms-submissions.json").rows;
const HELD = { v: 1, held: { qademo01: { "custom-63decdab6fbb": "2026-10-30T00:00:00Z" } } };
const input = (): ImportInput => ({ crm: crm(), submissions: submissions(), held: HELD });
const answers = (db: DB, id: string) =>
  (db.prepare("select form_version, answers, email, created_at from custom_form_responses where form_id = ? order by created_at").all(id) as { form_version: number; answers: string; email: string | null; created_at: string }[])
    .map((r) => ({ ...r, answers: JSON.parse(r.answers) as Record<string, unknown> }));
const count = (db: DB, table: string) => (db.prepare(`select count(*) as n from ${table}`).get() as { n: number }).n;

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
});

describe("importForms", () => {
  it("imports the representable forms, skips the rest with a reason, and counts the answers", () => {
    const report = importForms(db, input());
    expect(report.forms.map((f) => [f.id, f.status, f.reason])).toEqual([
      ["qademo01", "imported", undefined],
      ["swapdemo", "imported", undefined],
      ["filesdmo", "skipped", "unsupported question types: file, ranking"],
      ["draftdmo", "skipped", "never published (no form_versions row)"],
    ]);
    expect(count(db, "custom_forms")).toBe(2);
    expect(report.responses).toEqual({
      read: 12, imported: 5, existing: 0,
      skipped: { "deleted for good": 1, "deletion marker": 1, "removed from results (held)": 1, "form not imported": 2, "no valid date": 1, "no answers": 1 },
    });
  });

  it("keeps the live version's choices from the CRM definition, its settings and its old names", () => {
    importForms(db, input());
    const salon = openForm({ db, actor: null }, { slug: "qa-results-demo" })!;
    expect(salon.intro).toBe("Made-up answers for the import checks.\n\nSecond paragraph.");
    const q = Object.fromEntries(salon.questions.map((x) => [x.key, x])) as Record<string, Question>;
    expect(q.coming!.choices).toEqual([{ value: "yes", label: "Yes, see you there" }, { value: "no", label: "Not this time" }]);
    expect(q.diet!.choices!.map((c) => c.value)).toEqual(["vegan", "gf", "nuts"]);
    expect(q.recommend).toMatchObject({ type: "radio" });
    expect(q.recommend!.choices!.map((c) => c.value)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(q.recommend!.choices![0]!.label).toBe("0 — Not likely");
    expect(q.guest_name!.required).toBe(false); // show-if is not ported, so it can't stay required
    expect(db.prepare("select version, open, one_per_email from custom_forms where id = 'qademo01'").get()).toEqual({ version: 2, open: 1, one_per_email: 0 });
    expect(db.prepare("select slug from custom_form_old_slugs where form_id = 'qademo01'").all()).toEqual([{ slug: "salon-feedback" }]);
    const old = openForm({ db, actor: null }, { slug: "salon-feedback" })!;
    expect(old).toMatchObject({ slug: "qa-results-demo", moved: true });
  });

  it("converts rating, consent and time, drops statement and hidden, and keeps a closed form closed", () => {
    const report = importForms(db, input());
    expect(report.forms[1]).toMatchObject({ converted: { "time→short": 1, "rating→radio": 1, "consent→checkboxes": 1 }, dropped: { statement: 1, hidden: 1 } });
    const row = db.prepare("select open, one_per_email, closed_message, questions from custom_forms where id = 'swapdemo'").get() as { open: number; one_per_email: number; closed_message: string; questions: string };
    expect(row).toMatchObject({ open: 0, one_per_email: 1, closed_message: "The swap is full — see you in spring." });
    const qs = JSON.parse(row.questions) as Question[];
    expect(qs.map((q) => `${q.key}:${q.type}`)).toEqual(["name:short", "email:email", "arrive:short", "stars:radio", "consent:checkboxes"]);
    expect(qs.at(-1)).toEqual({ key: "consent", type: "checkboxes", label: "I'm happy for you to hold these details. See the privacy policy.", required: true, choices: [{ value: "yes", label: "I agree" }] });
    expect(openForm({ db, actor: null }, { slug: "winter-swap" })).toMatchObject({ closed: "The swap is full — see you in spring.", questions: [] });
  });

  it("stores old answers by their version's question keys, in the new shapes", () => {
    importForms(db, input());
    const salon = answers(db, "qademo01");
    expect(salon.map((r) => r.form_version)).toEqual([1, 2, 2, 2]);
    expect(salon[0]).toEqual({ form_version: 1, email: "una.v1@example.net", created_at: "2026-10-20T10:00:00.000Z", answers: { name: "Una Firstversion", email: "Una.V1@example.net", coming: "yes", heard: "Instagram" } });
    expect(salon[1]!.answers).toEqual({ name: "Zoe Accent", email: "zoe.accent@example.net", coming: "yes", diet: ["vegan", "gf"], plus_one: "yes", guest_name: "Ada Guest", recommend: "10", feedback: "Lovely evening!" });
    // The repeat answer (same email, one_per_email off) is a different line, so it is kept.
    expect(salon.filter((r) => r.email === "wren.again@example.net")).toHaveLength(2);
    const [swap] = answers(db, "swapdemo");
    expect(swap!.answers).toEqual({ name: "Sam Swap", email: "sam.swap@example.net", arrive: "18:30", stars: "4", src: "flyer", consent: ["yes"] });
  });

  it("is safe to run again: forms are updated by id and no answer is added twice", () => {
    importForms(db, input());
    const again = importForms(db, input());
    expect(again.forms.slice(0, 2).map((f) => f.status)).toEqual(["updated", "updated"]);
    expect(again.responses).toMatchObject({ imported: 0, existing: 5 });
    expect(count(db, "custom_form_responses")).toBe(5);
    expect(count(db, "custom_form_old_slugs")).toBe(1);
  });

  it("writes nothing on a dry run", () => {
    const report = importForms(db, input(), { dryRun: true });
    expect(report.responses.imported).toBe(5);
    expect(count(db, "custom_forms")).toBe(0);
    expect(count(db, "custom_form_responses")).toBe(0);
  });

  it("skips a form whose questions fail checkQuestions, and leaves nothing of it behind", () => {
    const dump = crm();
    const v = dump.form_versions.find((r) => r.kind === "custom:qademo01" && r.version === 2)!;
    v.definition = JSON.stringify({ fields: [{ key: "pick", type: "radio", label: "Pick one", choices: [{ value: "Not Valid!", label: "x" }] }] });
    const report = importForms(db, { ...input(), crm: dump });
    expect(report.forms[0]).toMatchObject({ status: "skipped", reason: "Question 1 needs 1 to 40 choices, each with its own value." });
    expect(count(db, "custom_form_old_slugs")).toBe(0);
    expect(report.responses.skipped["form not imported"]).toBe(10);
  });

  it("refuses a form whose link name the app keeps for itself, without stopping the others", () => {
    const dump = crm();
    dump.custom_forms[0]!.slug = "admin";
    const report = importForms(db, { ...input(), crm: dump });
    expect(report.forms[0]).toMatchObject({ status: "skipped", reason: expect.stringMatching(/^refused by the table/) });
    expect(report.forms[1]!.status).toBe("imported");
  });

  it("an imported form takes new answers at its slug and its old name", async () => {
    importForms(db, input());
    const send = (slug: string) => formRequest({ db, actor: null }, new Request(`http://club.test/api/forms/${slug}`, {
      method: "POST", headers: { "Content-Type": "application/json", "Content-Length": "200" },
      body: JSON.stringify({ answers: { name: "New Person", email: "new@example.net", coming: "yes", diet: ["nuts"], recommend: "8" } }),
    }), slug);
    expect((await send("qa-results-demo")).status).toBe(204);
    expect((await send("salon-feedback")).status).toBe(204);
    expect(answers(db, "qademo01")).toHaveLength(6);
  });
});

describe("the published fallback", () => {
  const withoutRow = (): ImportInput => {
    const dump = crm();
    dump.custom_forms = dump.custom_forms.filter((r) => r.id !== "qademo01");
    dump.form_versions = dump.form_versions.filter((r) => r.kind !== "custom:qademo01");
    return { crm: dump, published: readPublished(join(dir, "pub")) };
  };
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "forms-import-"));
    mkdirSync(join(dir, "pub"));
  });
  const publish = (fields: unknown[]) => writeFileSync(join(dir, "pub", "qademo01.json"), JSON.stringify({
    kind: "custom", id: "qademo01", name: "Salon feedback (demo)", slug: "qa-results-demo", old_slugs: ["salon-feedback"], version: 2, open: true,
    intro_html: "<p>Made-up &amp; plain.</p>\n<p>Two<br>lines</p>", thanks_html: "<p>Thank you &mdash; <span data-pipe=\"{name}\">friend</span>.</p>",
    closed_message: "", one_per_email: false, html: "<form>…</form>", fields,
  }));

  it("never invents choices from the HTML: a choice question without a CRM definition skips the form", () => {
    publish([{ key: "name", type: "short", required: true, label: "Your name" }, { key: "coming", type: "radio", required: false, label: "Are you coming?" }]);
    expect(importForms(db, withoutRow()).forms.find((f) => f.id === "qademo01")).toMatchObject({ status: "skipped", reason: "no CRM definition, and the published file keeps its choices only in HTML" });
  });

  it("takes words and settings from the file when its questions need no choices", () => {
    publish([{ key: "name", type: "short", required: true, label: "Your name" }, { key: "email", type: "email", required: true, label: "Email" }]);
    expect(importForms(db, withoutRow()).forms.find((f) => f.id === "qademo01")!.status).toBe("imported");
    expect(db.prepare("select intro, thanks, version from custom_forms where id = 'qademo01'").get()).toEqual({ intro: "Made-up & plain.\n\nTwo\nlines", thanks: "Thank you — friend.", version: 2 });
    expect(openForm({ db, actor: null }, { slug: "salon-feedback" })).toMatchObject({ moved: true });
  });

  it("htmlToText keeps paragraphs and decodes entities", () => {
    expect(htmlToText("<p>A &#8217;b&#x2019;</p><p>c</p>")).toBe("A ’b’\n\nc");
  });
});

describe("readCrmDb", () => {
  it("reads the CRM's tables from a SQLite file, custom versions only", () => {
    const path = join(mkdtempSync(join(tmpdir(), "crm-")), "crm.db");
    const dump = crm();
    const crmDb = new DatabaseSync(path);
    for (const [table, rows] of Object.entries(dump)) {
      const cols = Object.keys(rows[0]!);
      crmDb.exec(`create table ${table} (${cols.join(", ")})`);
      const ins = crmDb.prepare(`insert into ${table} values (${cols.map(() => "?").join(", ")})`);
      for (const r of rows) ins.run(...cols.map((c) => (r[c] as string | number | null) ?? null));
    }
    crmDb.close();
    const read = readCrmDb(path);
    expect(read.custom_forms).toHaveLength(4);
    expect(read.form_versions).toHaveLength(4);
    expect(importForms(db, { crm: read }).forms.filter((f) => f.status === "imported")).toHaveLength(2);
  });
});

describe("scripts/import-forms.ts", () => {
  it("prints counts, ids and slugs, never an answer or an email", () => {
    const out = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/import-forms.ts",
      "--crm-db", "scripts/fixtures/crm-forms.json", "--submissions", "scripts/fixtures/forms-submissions.json", "--db", ":memory:", "--dry-run"], { encoding: "utf8" });
    expect(out).toContain("DRY RUN");
    expect(out).toContain("qa-results-demo");
    expect(out).toContain("/f/* ready for 2 of 4 forms");
    for (const pii of ["@example", "Una", "Zoe", "Lovely", "18:30", "192.0.2"]) expect(out).not.toContain(pii);
  });
});
