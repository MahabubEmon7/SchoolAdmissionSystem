# Seed data

Loads demo data straight into the PostgreSQL database that the app uses.

| File | What it does |
| --- | --- |
| `seed.sh` | The command you run. Checks the database, asks before deleting, runs the SQL. |
| `seed.sql` | Replaces all data with the demo dataset. |
| `reset.sql` | Deletes all data, leaving one empty ACTIVE 2026 session. |

## Before you start

The app must be running, because the backend creates the tables on startup:

```bash
docker compose up -d
```

Run every command from the project folder (the one with `docker-compose.yml`).

## Commands

Load the demo data. The script asks before deleting anything:

```bash
./seed/seed.sh
```

Load it without the question, for scripts:

```bash
./seed/seed.sh seed -y
```

See what is in the database right now:

```bash
./seed/seed.sh status
```

Empty the database, the same as the admin **Reset** button:

```bash
./seed/seed.sh reset -y
```

Show all options:

```bash
./seed/seed.sh help
```

## Options

| Option | Default | What it controls |
| --- | --- | --- |
| `--hold-for <interval>` | `"8 minutes"` | How long the 35 held seats stay payable. When they run out, the app expires them and gives the seats to the waitlist. |
| `--opens-in <interval>` | `"7 days"` | When the 2027 session opens by itself. It then becomes ACTIVE and 2026 is archived. |
| `-y`, `--yes` | off | Skip the "delete all data?" question. |

An interval is a whole number and a unit: `"90 seconds"`, `"30 minutes"`, `"2 hours"`, `"7 days"`.

Watch held seats expire and the waitlist move up within a minute:

```bash
./seed/seed.sh seed -y --hold-for "1 minute"
```

Watch the 2027 session open by itself in two minutes:

```bash
./seed/seed.sh seed -y --opens-in "2 minutes"
```

## What gets loaded

| Year | Session | Classes | Students |
| --- | --- | --- | --- |
| 2025 | ARCHIVED | Class 1–3, Morning and Day (210 seats) | 100 confirmed |
| 2026 | ACTIVE | Class 1–6, Morning and Day (25 seats each) | 140 confirmed, 35 held, 25 waitlisted |
| 2027 | UPCOMING | Class 1–3, Morning and Day (250 seats) | none yet |

In 2026, Class 1 and Class 2 (both shifts) are exactly full: 20 confirmed and 5 held each, with the 25 waitlisted students queued behind them. Class 3–6 have free seats.

Every run produces the same IDs, names and Birth Registration Numbers (`20152691000000001` to `20152691000000300`). Type one of them into the app's student ID field to see that student's application. For example, `20152691000000241` has a held seat with a running payment timer, and `20152691000000276` is first on a waitlist.

The script refuses to finish if any class would end up with more students than seats.

## Using another PostgreSQL

By default the script uses the `postgres` container from `docker-compose.yml`, with the database name and user from `.env` (both default to `admissions`). To seed any other PostgreSQL, set `DATABASE_URL`. This needs `psql` installed on your computer:

```bash
DATABASE_URL=postgres://admissions:admissions@localhost:5432/admissions ./seed/seed.sh seed -y
```

That database needs the tables first, so point the backend at it once (`DATABASE_CONNECTION_STRING`) and let it start.

## Running the SQL by hand

```bash
docker compose exec -T postgres psql -U admissions -d admissions -v ON_ERROR_STOP=1 -v hold_for='8 minutes' -v opens_in='7 days' < seed/seed.sql
```

Both `-v` values are optional.

## The Seed button in the app

**Admission Sessions → Seed 3 Sessions & 300 Students** loads the same sessions, classes, students and names through the API (`POST /admin/seed`). Use the script when you want to choose the timings or seed from the terminal.
