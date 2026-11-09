/**
 * One-shot import of the CRM's custom forms and their old answers into the app's SQLite database (forms-import,
 * OPS-518), so apex /f/* can 301 to the new app. Runs on Node (`node:sqlite` is not available in Bun):
 *
 *   node --experimental-strip-types scripts/import-forms.ts --crm-db <crm.db> [--published-dir <published/custom>]
 *     [--submissions <submissions.jsonl>] [--held <held.json>] [--db <twc.db>] [--dry-run]
 *
 * `--crm-db` is a copy of the CRM's SQLite database (or a JSON dump of its custom_forms, custom_form_slugs and
 * form_versions tables, e.g. scripts/fixtures/crm-forms.json). `--published-dir` is only a fallback for a form whose
 * custom_forms row is missing; choices are never read from its HTML. `--held` keeps answers an admin removed from
 * results out. `--db` defaults to ${DATA_DIR:-./data}/twc.db. `--dry-run` prints the report and changes nothing.
 * Re-running updates forms by id and adds only new answers. Prints counts, ids, slugs and types, never an answer.
 * Back the database up first (README: sqlite3 … ".backup").
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { dataDir, openDb } from "../src/server/db.ts";
import { readRows } from "../src/server/legacy-import.ts";
import { importForms, readCrmDb, readPublished, type CrmDump } from "../src/features/forms/import.server.ts";

const { values } = parseArgs({
  options: {
    "crm-db": { type: "string" },
    "published-dir": { type: "string" },
    submissions: { type: "string" },
    held: { type: "string" },
    db: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
if (!values["crm-db"]) {
  console.error("Give --crm-db <copy of the CRM's crm.db, or a JSON dump of its form tables>.");
  process.exit(2);
}

const crmPath = values["crm-db"];
let crm: CrmDump;
try {
  crm = crmPath.endsWith(".json") ? (JSON.parse(readFileSync(crmPath, "utf8")) as CrmDump) : readCrmDb(crmPath);
} catch (error) {
  console.error(`Couldn't read the CRM's form tables from ${crmPath}: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
console.log(`read CRM: ${crm.custom_forms.length} forms, ${crm.custom_form_slugs.length} link names, ${crm.form_versions.length} versions`);
const published = values["published-dir"] ? readPublished(values["published-dir"]) : [];
if (values["published-dir"]) console.log(`read published: ${published.length} files`);
let submissions;
if (values.submissions) {
  const { rows, bad } = readRows(values.submissions);
  submissions = rows;
  console.log(`read submissions: ${rows.length} rows${bad ? `, ${bad} unreadable lines dropped` : ""}`);
}
const held: unknown = values.held ? JSON.parse(readFileSync(values.held, "utf8")) : undefined;

const db = openDb(values.db ?? join(dataDir(), "twc.db"));
const report = importForms(db, { crm, published, submissions, held }, { dryRun: values["dry-run"] });
console.log(values["dry-run"] ? "DRY RUN — nothing was written" : "imported");
console.table(report.forms.map((f) => ({ id: f.id, slug: f.slug, status: f.status, reason: f.reason ?? "", converted: JSON.stringify(f.converted), dropped: JSON.stringify(f.dropped) })));
const { read, imported, existing, skipped } = report.responses;
console.table({ responses: { read, imported, existing, skipped: JSON.stringify(skipped) } });
const ready = report.forms.filter((f) => f.status !== "skipped");
console.log(`/f/* ready for ${ready.length} of ${report.forms.length} forms${ready.length < report.forms.length ? "; skipped slugs stay on the old site" : ""}`);
