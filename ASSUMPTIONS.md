# Assumptions and design decisions

## Guaranteeing `held + confirmed ≤ totalSeats`

**PostgreSQL is the single source of truth, and every write that can change a class's occupancy runs inside a transaction that first locks that class's row with `SELECT … FOR UPDATE`.**

Creating a hold runs these steps in one transaction:

1. Take a per-student advisory lock (`pg_advisory_xact_lock(1, hashtext(studentId))`), so two applications from the same student, even to different classes, run one after the other.
2. `SELECT * FROM classes WHERE id = @classId FOR UPDATE`. Every other transaction for the same class waits here until this one commits or rolls back.
3. Read the clock (after the locks, so time order matches lock order).
4. Mark this student's overdue `HELD` rows (in any class) as `EXPIRED`, which frees their "one active application" slot.
5. Reject with `409 ALREADY_APPLIED` if the student still has a `WAITLISTED`, `HELD` or `CONFIRMED` application in **any** class.
6. Give any free seats to the waitlist first (see below), so a newcomer can't take a seat someone is queueing for.
7. Count occupied seats: `CONFIRMED`, plus `HELD` with `expires_at > now`. If the count is `≥ total_seats`, commit what steps 4 and 6 did and reject with `409 SEATS_FULL`.
8. Insert the new `HELD` row and commit.

Why this holds across processes:

- The lock lives in PostgreSQL, not in application memory, so it serialises writers from any number of API containers. A test runs two independent API hosts against one database to prove it.
- PostgreSQL's default `READ COMMITTED` isolation gives each statement a fresh snapshot. After waiting on the lock, the count in step 5 therefore sees every hold committed by the transaction that held the lock before.
- Only seats in the **same** class compete for the lock, so different classes never block each other.
- **Confirm** and **cancel** take the same class lock, then lock the hold row (`FOR UPDATE`). Every writer locks in the order *student → class → hold*, which rules out deadlocks. Confirm re-checks `expires_at > now` under the lock, so a hold that expired (and whose seat may already have gone to someone else) can never be confirmed.
- A partial unique index, `UNIQUE (student_id) WHERE status IN ('WAITLISTED','HELD','CONFIRMED')`, enforces "one active application per student" at the database level as a backstop. A violation is reported as `409 ALREADY_APPLIED`.

**Why not Redis/Redlock for the lock?** A Redis lock adds a second system that must agree with the database, plus failure modes such as lock expiry during a GC pause and split-brain on failover. Per the brief, `SELECT FOR UPDATE` alone is sufficient. It's also atomic with the write it protects, and it can't be released early. Redis is used only as a short-lived read cache (below), so if Redis fails, correctness is unaffected.

## Waitlist

**Problem:** when every seat is *held* but not yet paid, a newcomer used to see "Seats full" and leave, even though unpaid holds free up within minutes.

**Fix:** a class whose seats are all held offers **Join waitlist** (`POST /classes/{id}/waitlist`).

- A waitlisted application has status `WAITLISTED`, no `expires_at`, and doesn't use a seat. It counts as the student's one active application.
- Whenever a seat frees up, it's offered to the waitlist in order (`queue_number`, a database identity column, so order never depends on clock precision). The waitlisted application becomes `HELD` with a **fresh** `HOLD_DURATION_SECONDS` payment window.
- Promotion happens inside the same class lock as every other seat change, so it can never overfill a class. It runs:
  - immediately when a hold is cancelled,
  - before any new application to that class is considered (newcomers can't jump the queue), and
  - in the background worker each second, which picks up holds that simply expired.
- Joining the waitlist when a seat is actually free just holds that seat straight away.
- If every seat is **confirmed**, nothing can free up, so the class shows *Admission closed* and the waitlist endpoint returns `409 CLASS_FULL`.
- `POST /classes/{id}/holds` still returns `409 SEATS_FULL` when no seat is free, as the API contract requires. The waitlist is a separate, additive endpoint.
- A waitlisted student can't pay (`409 HOLD_WAITLISTED`) and can leave the waitlist with `DELETE /holds/{id}`.
- The frontend polls the student's applications every 3 seconds and shows a "seat opened" message when one turns from `WAITLISTED` to `HELD`. There's no email or SMS notification, so the student needs the page open or must check back.

## Hold expiry

- `expires_at = created_at + HOLD_DURATION_SECONDS` is stored on the hold.
- **Expiry needs no API call and no background job to be correct.** Every read and every seat count treats `HELD` rows with `expires_at <= now` as `EXPIRED`, so a seat becomes available the moment its deadline passes.
- `HoldExpiryWorker` (an `IHostedService`) runs every `EXPIRY_SWEEP_SECONDS` (default 1 s) and writes `status = 'EXPIRED'` for overdue holds, so stored data matches what clients see. It's idempotent and safe to run in every API instance at once. After a restart it catches up immediately.
- Time comes from .NET's `TimeProvider`, so tests use a fake clock instead of sleeping. Multiple API instances are assumed to have NTP-synchronised clocks (containers on one host share the host clock).
- The frontend counts down from `expiresAt` using the browser clock. At zero it shows `EXPIRED` and disables **Pay** right away, then refreshes from the server. The server still has the final say, so a skewed browser clock can't confirm an expired hold.

## Business rules

- **Payment is simulated.** There's no payment gateway: **Payment complete** calls `POST /holds/{id}/confirm`, which counts as "fee paid".
- **Idempotency:** confirming a `CONFIRMED` hold returns `200` with the same body and changes nothing. Cancelling a `CANCELLED` hold returns `204` again.
- A **confirmed** admission can't be cancelled through the API (`409 HOLD_CONFIRMED`). The brief only defines cancelling a hold, and freeing a paid seat is an administrative action.
- Cancelling or confirming an **expired** hold returns `409 HOLD_EXPIRED`. Confirming a **cancelled** hold returns `409 HOLD_CANCELLED`.
- After a hold is cancelled or expires, the student may apply again if seats are free.
- Only the owning student (matching `X-Student-Id`) can confirm or cancel a hold (`403` otherwise). `GET /holds/{id}` is open, as in the brief, and deliberately omits `studentId`.
- **Student ID** is exactly 17 ASCII digits, kept as a string so leading zeros survive. Invalid or missing values return `400 INVALID_STUDENT_ID`. There's no login, as the brief specifies, so the ID is trusted as given.
- **One class per student:** a student (Birth Registration Number) can have only one active application, whether `WAITLISTED`, `HELD` or `CONFIRMED`, across all classes, because a student studies in one class at a time. A confirmed admission keeps blocking other applications; a cancelled or expired one doesn't.
- **Classes** are **Class 1 to Class 12**, with an optional shift (`MORNING` or `DAY`). Each grade/shift pair exists once (`409 CLASS_EXISTS`). The display name is generated: `Class 6` or `Class 6 - Morning Shift`. Clients may send `grade` + `shift`, or (for the original contract) a `name` like "Class 6 - Morning Shift", which is parsed. Seats are 1–100,000. Class creation is open, since the brief has no admin authentication. Classes are listed by grade, then no shift, Morning, Day.
- **Upgrading existing data** (migration `GradesWaitlistOneClassPerStudent`):
  - Each class's grade and shift are read from its name. The migration stops with a clear message if a name has no grade from 1 to 12, or if two classes would collide.
  - A student with several active applications keeps their confirmed one (or, if none is confirmed, their earliest one). The others are cancelled, which releases their seats.
- Ids are UUIDs, and timestamps are UTC ISO-8601 (`2026-11-01T04:10:00.000Z`).

## Caching (Redis)

- `GET /classes` and `GET /classes/{id}` are cached in Redis for `CACHE_TTL_SECONDS` (default 2 s).
- Every write (and every expiry sweep that changes rows) deletes the affected keys, so caches across instances are invalidated together.
- The worst case is a count that's up to one TTL stale, which matches the frontend's 3 s polling. Seat **enforcement** never reads the cache.
- If Redis is unreachable, the API logs once, serves from PostgreSQL, and retries Redis after 15 s.

## Persistence and operations

- PostgreSQL data lives in a named volume, so `docker compose down` followed by `up` loses nothing. Redis holds only cache data, so it isn't persisted.
- EF Core migrations run at startup under a PostgreSQL advisory lock, so several instances can start at once. Startup retries while the database is still booting.
- The frontend image is built once. The backend URL is injected when the container starts (`API_URL` → `/runtime-config.js`).
