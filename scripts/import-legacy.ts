/**
 * One-shot import of the old site's data into the app's SQLite database (BRIEF decision 10).
 * Runs on Node (`node:sqlite` is not available in Bun):
 *
 *   node --experimental-strip-types scripts/import-legacy.ts --dir /opt/nbwc/data [--db <twc.db>] [--dry-run] [--inbox-new]
 *
 * `--dir` is the old data folder (intake/new_applications.jsonl, intake/members.jsonl, intake/subscribers.jsonl,
 * submissions.jsonl); `--applications/--members/--subscribers/--submissions <file>` override one source each (a
 * `.json` array works too, e.g. scripts/fixtures/legacy-*.json). `--db` defaults to ${DATA_DIR:-./data}/twc.db.
 * `--dry-run` prints the report and changes nothing. Re-running imports only what is new. Prints counts, never
 * row contents. Back the database up first (README: sqlite3 … ".backup").
 */
import { join } from "node:path";
import { parseArgs } from "node:util";
import { dataDir, openDb } from "../src/server/db.ts";
import { importLegacy, readRows, type Sources } from "../src/server/legacy-import.ts";

const { values } = parseArgs({
  options: {
    dir: { type: "string" },
    db: { type: "string" },
    applications: { type: "string" },
    members: { type: "string" },
    subscribers: { type: "string" },
    submissions: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "inbox-new": { type: "boolean", default: false },
  },
});

const from = (flag: string | undefined, rel: string) => flag ?? (values.dir ? join(values.dir, rel) : undefined);
const files = {
  applications: from(values.applications, "intake/new_applications.jsonl"),
  members: from(values.members, "intake/members.jsonl"),
  subscribers: from(values.subscribers, "intake/subscribers.jsonl"),
  submissions: from(values.submissions, "submissions.jsonl"),
};
if (!Object.values(files).some(Boolean)) {
  console.error("Give --dir <old data folder> or at least one of --applications/--members/--subscribers/--submissions.");
  process.exit(2);
}

const sources: Sources = {};
for (const [name, path] of Object.entries(files)) {
  if (!path) continue;
  const { rows, bad } = readRows(path);
  sources[name as keyof Sources] = rows;
  console.log(`read ${name}: ${rows.length} rows${bad ? `, ${bad} unreadable lines dropped` : ""}`);
}

const db = openDb(values.db ?? join(dataDir(), "twc.db"));
const report = importLegacy(db, sources, { dryRun: values["dry-run"], inboxStatus: values["inbox-new"] ? "new" : "archived" });
console.log(values["dry-run"] ? "DRY RUN — nothing was written" : "imported");
console.table(
  Object.fromEntries(Object.entries(report).map(([k, c]) => [k, { read: c.read, imported: c.imported, existing: c.existing, skipped: JSON.stringify(c.skipped) }])),
);
