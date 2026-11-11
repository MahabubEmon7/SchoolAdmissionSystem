# AI usage

AI coding assistants were used throughout this assignment.

- **Codex** produced the first version: a .NET API using raw SQL, a single-file React UI and Node-based tests.
- **Claude Code (Claude Opus)** rebuilt the project against the brief's stack. That covered the .NET 8 + EF Core backend, the Redis cache, Class 1–12 classes, the one-class-per-student rule, the waitlist, the xUnit suite (including the 200-request concurrency test), the TypeScript/Tailwind frontend split into small components, Docker Compose, and these docs.

How the output was checked:

- All 58 backend tests were run against real PostgreSQL in Docker, and the 13 frontend tests with Vitest.
- The full stack was run with `docker compose up --build`. The API was exercised with `curl`, and the UI was driven in a browser, covering apply, countdown, expiry, payment, the offline state and the phone layout.
- Persistence was confirmed across `docker compose down` / `up`.

Bugs found and fixed along the way:

- A Development-only `500` on malformed JSON.
- Expected `409`s being logged as server errors.
- An EF Core package version conflict.
- Waitlist order depending on timestamps that could tie (replaced with a database sequence).
- A rejected application undoing the waitlist promotion it had just done.
- A CORS preflight on every request.

<!-- Add your own notes here: what you asked for, what you changed by hand, and what you reviewed. -->
