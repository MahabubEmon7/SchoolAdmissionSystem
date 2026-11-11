# School Admission System

Students hold a seat in a class (Class 1–12), then confirm it by marking the admission fee as paid before the hold expires. If every seat is on hold, students can join a **waitlist** and get the next seat automatically when a hold isn't paid in time. Each student can have only **one active application** across all classes. Seat limits hold under heavy concurrent load, across any number of API instances.

| Part | Stack |
| --- | --- |
| Backend | .NET 8 Web API (minimal APIs), EF Core 8, PostgreSQL 16, Redis 7 (read cache) |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS 4, React Query, Zustand, react-toastify |
| Infra | Docker Compose |

## Run it

```bash
docker compose up --build
```

| What | URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| API docs (Swagger) | http://localhost:8080/swagger |

Stop with `docker compose down`. Data is kept in the `postgres-data` volume, so `docker compose up` brings everything back. To wipe the data, use `docker compose down -v`.

### Using the app

1. Enter a 17-digit Birth Registration Number in the field at the top (for example `20152691234567890`). It's saved in your browser.
2. **Admin** tab: pick a **Class (1–12)**, an optional **shift** (Morning or Day) and the number of seats. Each class/shift pair can exist only once.
3. **Classes** tab: select **Apply**. Seat counts refresh every 3 seconds. A student can apply to **one class at a time**; other classes show "Already applied elsewhere" until that application is cancelled or expires.
4. **My applications** tab: a countdown shows how long the seat is held. Select **Pay Admission Fee**, then **Payment complete** to confirm. There's no payment gateway; that button marks the fee as paid. **Cancel** releases the seat.
5. If the timer reaches zero, the card switches to **Expired** and **Pay** is disabled, with no reload needed.
6. **All seats on hold?** The class shows **Join waitlist** instead of "full". When a held seat isn't paid in time (or is cancelled), it goes to the first student in line, whose own payment timer starts, and the page shows a "seat opened" message. A class only shows **Admission closed** when every seat is confirmed.

To watch a hold expire quickly:

```bash
HOLD_DURATION_SECONDS=30 docker compose up --build
```

## Configuration

Set these in your shell or in a `.env` file next to `docker-compose.yml`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOLD_DURATION_SECONDS` | `600` | How long a seat stays held before it expires |
| `API_URL` | `http://localhost:8080` | Backend address as seen by the **browser**. It's read when the frontend container starts, so no rebuild is needed. |
| `API_PORT` | `8080` | Host port for the backend. If you change it, also change `API_URL`. |
| `FRONTEND_PORT` | `3000` | Host port for the frontend |
| `CORS_ORIGINS` | `*` | Comma-separated list of allowed browser origins |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `admissions` | Database credentials |

The backend itself reads `DATABASE_CONNECTION_STRING`, `REDIS_CONNECTION_STRING` (leave it empty to run without Redis), `HOLD_DURATION_SECONDS`, `EXPIRY_SWEEP_SECONDS` (default `1`), `CACHE_TTL_SECONDS` (default `2`) and `CORS_ORIGINS`. Compose sets these for you.

## Tests

### Backend (xUnit), with Docker only

```bash
docker compose --profile test run --rm --build backend-tests
```

This runs the suite against the Compose PostgreSQL. Each test class creates its own temporary database and drops it afterwards.

### Backend, with the .NET 8 SDK installed

```bash
cd backend && dotnet test
```

With no configuration, the tests start a throwaway PostgreSQL container through Testcontainers, so Docker must be running. To use an existing server instead, set `TEST_DATABASE_CONNECTION_STRING` (the user needs `CREATEDB`).

What the 58 tests cover:

- **Concurrency**: 200 simultaneous hold requests for 120 seats give exactly 120 × `201` and 80 × `409 SEATS_FULL`.
- The same limit holds when requests are split across **two API instances** sharing one database.
- 20 simultaneous applications from one student, to one class or to 8 different classes, give exactly one hold.
- **Waitlist**: queueing in order, promotion on cancel and on expiry (also by the background worker alone), newcomers can't jump the queue, no waitlist once every seat is confirmed, and 5 seats freed at once go to exactly the first 5 in line.
- **Classes**: Class 1–12 only, optional Morning/Day shift, no duplicates, sorted by grade then shift.
- 25 simultaneous confirmations of one hold count the seat once.
- **Expiry**: a controllable fake clock checks that unpaid holds expire without any API call, free their seat, can't be confirmed afterwards, and that the background worker stores `EXPIRED`.
- Lifecycle: idempotent confirm and cancel, ownership checks (`403`), ID validation (`400`), `404`s, malformed JSON, and response shapes.

### Frontend

```bash
cd frontend && npm install && npm test
```

## API

All bodies are JSON. Student endpoints need the `X-Student-Id: <17 digits>` header.

| Method | Path | Success | Header |
| --- | --- | --- | --- |
| POST | `/classes` | 201 `{ id, name, totalSeats, grade, shift }` | |
| GET | `/classes` | 200 `[{ id, name, totalSeats, heldSeats, confirmedSeats, availableSeats, grade, shift, waitlistCount }]` | |
| GET | `/classes/{classId}` | 200 (same object) | |
| POST | `/classes/{classId}/holds` | 201 `{ holdId, classId, studentId, status, expiresAt }` | ✓ |
| POST | `/classes/{classId}/waitlist` | 201, same shape plus `waitlistPosition` (`status` is `WAITLISTED`, or `HELD` if a seat was free) | ✓ |
| GET | `/holds/{holdId}` | 200 `{ holdId, classId, className, status, expiresAt }` | |
| POST | `/holds/{holdId}/confirm` | 200 `{ holdId, status: "CONFIRMED" }` | ✓ |
| DELETE | `/holds/{holdId}` | 204 | ✓ |
| GET | `/me/holds` | 200 `[{ holdId, classId, className, status, expiresAt, createdAt, waitlistPosition }]` | ✓ |

**Creating a class:** send `{ "grade": 6, "shift": "MORNING", "totalSeats": 120 }` (`shift` is `MORNING`, `DAY` or omitted). The original `{ "name": "Class 6 - Morning Shift", "totalSeats": 120 }` also works: the name is read as grade + shift and must describe Class 1–12.

**Statuses:** `WAITLISTED` → `HELD` → `CONFIRMED`, or `EXPIRED` / `CANCELLED`. `expiresAt` is `null` while waitlisted.

Errors always look like `{ "error": "SEATS_FULL", "message": "Seats are full for this class." }`.

| Status | `error` codes |
| --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_STUDENT_ID`, `INVALID_REQUEST` |
| 403 | `FORBIDDEN` (the hold belongs to another student) |
| 404 | `CLASS_NOT_FOUND`, `HOLD_NOT_FOUND`, `NOT_FOUND` |
| 409 | `SEATS_FULL`, `ALREADY_APPLIED` (student already has an active application, in any class), `CLASS_EXISTS`, `CLASS_FULL` (every seat confirmed, no waitlist), `HOLD_WAITLISTED` (can't pay before a seat is held), `HOLD_EXPIRED`, `HOLD_CANCELLED`, `HOLD_CONFIRMED` |

## Project layout

```
backend/
  src/Admission.Api/
    Domain/          entities and rules (Hold, SchoolClass, StudentId)
    Data/            EF Core DbContext, migrations, startup migrator
    Services/        ClassService, AdmissionService, SeatLedger (locks + waitlist), HoldExpiryWorker, Redis cache
    Endpoints/       minimal API route groups
    Infrastructure/  options, error types and handlers, X-Student-Id parsing
  tests/Admission.Tests/
frontend/src/
  components/ui/       Button, Card, Field, Badge, Dialog, EmptyState, ...
  components/layout/   dashboard layout, sidebar, header, student ID field, error boundary, offline banner
  features/            classes (incl. applyState: what the Apply button does), applications, admin, sessions
  hooks/               React Query hooks, countdown
  store/               Zustand store (persisted student ID)
  lib/                 API client, config, formatting
seed/                  demo data loader: ./seed/seed.sh (see seed/README.md)
```

See [ASSUMPTIONS.md](ASSUMPTIONS.md) for how the seat limit is guaranteed.
