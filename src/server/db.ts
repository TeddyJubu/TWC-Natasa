// The app's one SQLite database (node:sqlite). Server-only: imported by *.server.ts modules and server routes.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type DB = DatabaseSync;

// ponytail: resolved from the working directory (`bun run start` runs at the repo root); the bundled server
// has no stable path back to the source tree.
export const MIGRATIONS_DIR = resolve(process.cwd(), "db/migrations");
export const dataDir = () => resolve(process.env.DATA_DIR || "./data");

/** Applies every `NNNN_name.sql` newer than `PRAGMA user_version`, in order, each in its own transaction. */
export function migrate(db: DB, dir = MIGRATIONS_DIR): void {
  const current = Number((db.prepare("pragma user_version").get() as { user_version: number }).user_version);
  const files = readdirSync(dir).filter((f) => /^\d{4}_[\w-]+\.sql$/.test(f)).sort();
  for (const file of files) {
    const version = Number(file.slice(0, 4));
    if (version <= current) continue;
    db.exec("begin");
    try {
      db.exec(readFileSync(join(dir, file), "utf8"));
      db.exec(`pragma user_version = ${version}`);
      db.exec("commit");
    } catch (error) {
      db.exec("rollback");
      throw new Error(`migration ${file} failed: ${(error as Error).message}`);
    }
  }
}

/** Opens (and migrates) a database: a file path, or ":memory:" for tests. */
export function openDb(path: string): DB {
  const db = new DatabaseSync(path);
  if (path !== ":memory:") db.exec("pragma journal_mode = wal");
  db.exec("pragma foreign_keys = on; pragma busy_timeout = 5000");
  migrate(db);
  return db;
}

let shared: DB | undefined;

/** The server's database at `${DATA_DIR ?? "./data"}/twc.db`, opened on first use. */
export function getDb(): DB {
  if (!shared) {
    mkdirSync(dataDir(), { recursive: true });
    shared = openDb(join(dataDir(), "twc.db"));
  }
  return shared;
}

/** Runs `fn` in one transaction (nested calls join the outer one). */
export function tx<T>(db: DB, fn: () => T): T {
  if (db.isTransaction) return fn();
  db.exec("begin immediate");
  try {
    const result = fn();
    db.exec("commit");
    return result;
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
}

export const now = () => new Date().toISOString();
