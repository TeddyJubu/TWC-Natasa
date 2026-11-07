#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres (with Supabase stubs) and runs the RLS checks.
# Usage: drizzle/test/run.sh   — needs initdb/pg_ctl/psql on PATH.
# With TEST_DB_EXISTING=1 (CI's postgres service) it uses an existing server instead, via the standard libpq
# env (PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE). That server must be fresh: the stub creates cluster-wide
# roles. Opt-in, so a PGHOST exported for other work never points this at a real database.
set -euo pipefail
cd "$(dirname "$0")/../.."
if [[ "${TEST_DB_EXISTING:-}" == 1 ]]; then
  psql=(psql -v ON_ERROR_STOP=1 -q)
else
  dir="$(mktemp -d "${TMPDIR:-/tmp}/twc-pg.XXXXXX")"
  sock="$(mktemp -d /tmp/twc.XXXX)"   # unix socket paths max out around 104 chars
  trap 'pg_ctl -D "$dir/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$dir" "$sock"' EXIT

  initdb -D "$dir/data" -U postgres --auth=trust >/dev/null
  pg_ctl -D "$dir/data" -o "-k $sock -c listen_addresses=''" -l "$dir/log" -w start >/dev/null || { cat "$dir/log"; exit 1; }
  psql=(psql -h "$sock" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
fi

"${psql[@]}" -f drizzle/test/supabase-stub.sql
for m in drizzle/migrations/*.sql; do echo "applying $m"; "${psql[@]}" -f "$m"; done
"${psql[@]}" -f drizzle/test/rls.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
echo "all checks passed"
