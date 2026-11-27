// Sends the membership applicants who opted in to the newsletter while the Beehiiv keys were missing on to Beehiiv,
// through the same optInApplicant() as a new application (explicit consent, never an address already known, no
// reactivation, Beehiiv's double opt-in). Prints only a count unless --confirm; never prints an address.
// Node, not bun (bun has no node:sqlite); tsx resolves the `@/` imports. On the VPS, from /opt/twc-natasa:
//   sudo -u www-data env $(grep -E '^(DATA_DIR|BEEHIIV_[A-Z_]+)=' /etc/twc-natasa/app.env | xargs) node --import tsx scripts/newsletter-backfill.ts [--confirm]
import { dataDir, openDb } from "@/server/db";
import { missedOptIns, optInApplicant } from "@/features/applications/applications.server";

const db = openDb(`${dataDir()}/twc.db`);
const missed = missedOptIns(db);
console.log(`${missed.length} opt-in(s) never reached Beehiiv`);
if (process.argv.includes("--confirm")) {
  if (!process.env.BEEHIIV_API_KEY || !process.env.BEEHIIV_PUBLICATION_ID) throw new Error("BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID must be set");
  for (const applicant of missed) await optInApplicant(db, applicant);
  console.log(`${missed.length - missedOptIns(db).length} sent; ${missedOptIns(db).length} left (a failed send is released and can be retried)`);
}
