// Imports a Lovable/Supabase JSON export into an EMPTY database at ${DATA_DIR:-./data}/twc.db.
// Usage (from the repo root): DATA_DIR=/srv/twc/data node scripts/import-lovable.ts export.json
// The export's keys: users (auth.users rows), identities (auth.identities rows), profiles, user_roles, events,
// event_rsvps, headshot_bookings, and neighborhoods / applications when present. One transaction; prints counts.
import { readFileSync } from "node:fs";
import { getDb } from "../src/server/db.ts";
import { importLovable } from "../src/server/import-lovable.ts";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/import-lovable.ts <export.json>");
  process.exit(2);
}
try {
  const counts = importLovable(getDb(), JSON.parse(readFileSync(file, "utf8")));
  console.log("Imported:");
  for (const [table, n] of Object.entries(counts)) console.log(`  ${table}: ${n}`);
} catch (error) {
  console.error(`Import failed, nothing was written: ${(error as Error).message}`);
  process.exit(1);
}
