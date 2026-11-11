#!/usr/bin/env bash
# Loads, clears or inspects the School Admission System database.
# Run ./seed/seed.sh help for usage.
set -euo pipefail

SEED_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SEED_DIR")"
cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
Usage: ./seed/seed.sh [command] [options]

Commands:
  seed      Replace all data with the demo dataset (default)
  reset     Delete all data, leaving one empty ACTIVE 2026 session
  status    Show what is in the database now
  help      Show this help

Options for seed:
  --hold-for <interval>   How long the 35 held seats stay payable   (default "8 minutes")
  --opens-in <interval>   When the 2027 session opens by itself     (default "7 days")
                          An interval is a number and a unit: "90 seconds", "30 minutes",
                          "2 hours", "7 days".
Options for seed and reset:
  -y, --yes               Do not ask before deleting data

Database:
  By default the script uses the "postgres" service from docker-compose.yml.
  Set DATABASE_URL to use any other PostgreSQL instead (needs psql installed):
    DATABASE_URL=postgres://user:pass@localhost:5432/admissions ./seed/seed.sh

Examples:
  ./seed/seed.sh                          # demo data, asks first
  ./seed/seed.sh seed -y --hold-for "1 minute"
  ./seed/seed.sh reset -y
  ./seed/seed.sh status
EOF
}

die() { echo "Error: $*" >&2; exit 1; }

# --- arguments ----------------------------------------------------------------
command="seed"
hold_for="8 minutes"
opens_in="7 days"
assume_yes=false

if [[ $# -gt 0 && "$1" != -* ]]; then command="$1"; shift; fi
while [[ $# -gt 0 ]]; do
  case "$1" in
    --hold-for) [[ $# -ge 2 ]] || die "--hold-for needs a value"; hold_for="$2"; shift 2 ;;
    --opens-in) [[ $# -ge 2 ]] || die "--opens-in needs a value"; opens_in="$2"; shift 2 ;;
    -y|--yes)   assume_yes=true; shift ;;
    -h|--help)  command="help"; shift ;;
    *)          die "unknown option '$1' (see ./seed/seed.sh help)" ;;
  esac
done

interval_pattern='^[1-9][0-9]* ?(seconds?|minutes?|hours?|days?)$'
[[ "$hold_for" =~ $interval_pattern ]] || die "--hold-for must look like \"8 minutes\", got \"$hold_for\""
[[ "$opens_in" =~ $interval_pattern ]] || die "--opens-in must look like \"7 days\", got \"$opens_in\""

# --- database connection --------------------------------------------------------
# Same defaults as docker-compose.yml, overridable from the shell or .env.
if [[ -f .env ]]; then set -a; . ./.env; set +a; fi
db_name="${POSTGRES_DB:-admissions}"
db_user="${POSTGRES_USER:-admissions}"

psql_run() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 "$@"
  else
    docker compose exec -T postgres psql -X -q -v ON_ERROR_STOP=1 -U "$db_user" -d "$db_name" "$@"
  fi
}

check_database() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    command -v psql >/dev/null || die "DATABASE_URL is set but psql is not installed"
    target="database from DATABASE_URL"
  else
    command -v docker >/dev/null || die "Docker is not installed"
    docker info >/dev/null 2>&1 || die "Docker is not running. Start Docker Desktop first."
    if ! docker compose ps --status running --services 2>/dev/null | grep -qx postgres; then
      die "the postgres container is not running. Start the app first:  docker compose up -d"
    fi
    target="database \"$db_name\" in the postgres container"
  fi

  local tables
  tables="$(psql_run -tA -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'
                              AND tablename IN ('academic_sessions', 'classes', 'holds')")" \
    || die "cannot connect to the $target"
  [[ "$tables" == 3 ]] || die "the tables do not exist yet. The backend creates them on startup:
  docker compose up -d backend   (wait a few seconds, then run this again)"
}

confirm() {
  $assume_yes && return 0
  [[ -t 0 ]] || die "refusing to delete data without confirmation; add -y"
  read -r -p "This deletes ALL data in the $target. Continue? [y/N] " answer
  [[ "$answer" =~ ^[Yy]([Ee][Ss])?$ ]] || { echo "Cancelled."; exit 1; }
}

show_status() {
  psql_run -P footer=off -c "
    SELECT s.academic_year AS year, s.status AS session,
           to_char(s.starts_at, 'YYYY-MM-DD HH24:MI TZ') AS opens_at,
           count(DISTINCT c.id) AS classes,
           count(h.id) FILTER (WHERE h.status = 'CONFIRMED')  AS confirmed,
           count(h.id) FILTER (WHERE h.status = 'HELD' AND h.expires_at > now()) AS held,
           count(h.id) FILTER (WHERE h.status = 'WAITLISTED') AS waitlisted,
           count(h.id) FILTER (WHERE h.status = 'EXPIRED' OR (h.status = 'HELD' AND h.expires_at <= now())) AS expired,
           count(h.id) FILTER (WHERE h.status = 'CANCELLED')  AS cancelled
    FROM academic_sessions s
    LEFT JOIN classes c ON c.academic_year = s.academic_year
    LEFT JOIN holds h   ON h.class_id = c.id
    GROUP BY s.academic_year, s.status, s.starts_at
    ORDER BY s.academic_year;"
}

# --- commands -------------------------------------------------------------------
case "$command" in
  help)
    usage ;;
  status)
    check_database
    show_status ;;
  seed)
    check_database
    confirm
    echo "Seeding the $target (held seats payable for $hold_for, 2027 opens in $opens_in)..."
    psql_run -P footer=off -v hold_for="$hold_for" -v opens_in="$opens_in" < "$SEED_DIR/seed.sql"
    echo "Done. Open http://localhost:3000 to see the data." ;;
  reset)
    check_database
    confirm
    psql_run < "$SEED_DIR/reset.sql"
    echo "Done. The database is empty except for the ACTIVE 2026 session." ;;
  *)
    die "unknown command '$command' (see ./seed/seed.sh help)" ;;
esac
