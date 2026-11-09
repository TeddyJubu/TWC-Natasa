/**
 * Puts the made-up custom forms (src/features/forms/fixtures.ts) into a local database, so /f/salon-rsvp,
 * /f/salon-rsvp-old (→ 301) and /f/old-survey (closed) work without the VPS's data. Never run it on the VPS.
 * Runs on Node (`node:sqlite` is not available in Bun):
 *
 *   node --experimental-strip-types scripts/seed-forms.ts [--db <twc.db>]
 *
 * `--db` defaults to ${DATA_DIR:-./data}/twc.db. Re-running replaces the same two forms by id.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { dataDir, openDb } from "../src/server/db.ts";
import { DEMO_FORMS } from "../src/features/forms/fixtures.ts";
import { saveForm } from "../src/features/forms/store.ts";

const { values } = parseArgs({ options: { db: { type: "string" } } });
const path = values.db ?? join(dataDir(), "twc.db");
mkdirSync(dirname(path), { recursive: true });
const db = openDb(path);
for (const form of DEMO_FORMS) saveForm(db, form);
console.log(`seeded ${DEMO_FORMS.length} demo forms: ${DEMO_FORMS.map((f) => `/f/${f.slug}`).join(", ")}`);
