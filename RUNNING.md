# Running the School Admission System

Every command below is meant to be copied and pasted into a terminal.

> **Run all `docker compose` commands from the project folder**, the one that contains `docker-compose.yml`:
>
> ```bash
> cd ~/Downloads/School-Admission-System
> ```

---

## 1. First-time setup (only if Docker isn't installed)

You only need **Docker**. .NET, Node.js and PostgreSQL all run inside containers, so you don't install them yourself.

Check whether Docker is already installed and running:

```bash
docker --version && docker compose version && docker info --format 'Docker is running: {{.ServerVersion}}'
```

If all three lines print, skip to [section 2](#2-start-the-app). Otherwise, install Docker for your system below.

### macOS

Install Docker Desktop with Homebrew:

```bash
brew install --cask docker
```

If you don't have Homebrew, install it first and then run the command above again:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then open Docker Desktop and wait until the whale icon in the menu bar stops animating:

```bash
open -a Docker
```

Without Homebrew, download Docker Desktop from https://www.docker.com/products/docker-desktop/ instead.

### Windows

Run this in **PowerShell as Administrator**, then restart your computer:

```powershell
winget install -e --id Docker.DockerDesktop
```

After the restart, open **Docker Desktop** from the Start menu and wait until it says *Engine running*. Run the commands in this guide from PowerShell.

### Linux (Ubuntu / Debian)

```bash
curl -fsSL https://get.docker.com | sudo sh
```

Let your user run Docker without `sudo` (log out and back in afterwards):

```bash
sudo usermod -aG docker $USER
```

```bash
sudo systemctl enable --now docker
```

Finally, run the check command at the top of this section again to confirm everything works.

---

## 2. Start the app

The first run downloads images and builds everything, which takes a few minutes. Later starts take seconds.

Start in the background:

```bash
docker compose up --build -d
```

Check that all four services are up (`postgres` and `redis` should say `healthy`):

```bash
docker compose ps
```

Then open the app:

| What | URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080/classes |
| API docs (Swagger) | http://localhost:8080/swagger |
| Health check | http://localhost:8080/health |

On macOS you can open the frontend straight from the terminal:

```bash
open http://localhost:3000
```

### Other ways to start

To start in the foreground with live logs (press `Ctrl + C` to stop):

```bash
docker compose up --build
```

To use a short hold time, here 30 seconds, so you can watch a seat expire:

```bash
HOLD_DURATION_SECONDS=30 docker compose up --build -d
```

To go back to the normal 10-minute hold:

```bash
docker compose up --build -d
```

---

## 3. See logs

Follow the logs from every service live (`Ctrl + C` stops watching; the app keeps running):

```bash
docker compose logs -f
```

Follow the backend logs only:

```bash
docker compose logs -f backend
```

Follow the frontend logs only. These are nginx access logs, and the first line shows which API URL the frontend uses:

```bash
docker compose logs -f frontend
```

Follow the database logs only:

```bash
docker compose logs -f postgres
```

Follow the Redis logs only:

```bash
docker compose logs -f redis
```

Show the last 100 backend lines and exit:

```bash
docker compose logs --tail 100 backend
```

Show backend logs from the last 10 minutes, with timestamps:

```bash
docker compose logs --since 10m -t backend
```

Show only errors and warnings from the backend:

```bash
docker compose logs backend 2>&1 | grep -iE "fail|error|warn"
```

---

## 4. Stop the app

Stop everything. **Your data is kept.**

```bash
docker compose down
```

Pause the containers without removing them:

```bash
docker compose stop
```

Start them again after a pause:

```bash
docker compose start
```

Stop only one service. This example stops the backend, which lets you see the frontend's "Server offline" message:

```bash
docker compose stop backend
```

```bash
docker compose start backend
```

---

## 5. Restart and rebuild

Restart all services without rebuilding:

```bash
docker compose restart
```

Restart only the backend:

```bash
docker compose restart backend
```

After changing code, rebuild and restart everything:

```bash
docker compose up --build -d
```

Rebuild only the backend:

```bash
docker compose up --build -d backend
```

Rebuild only the frontend:

```bash
docker compose up --build -d frontend
```

Do a full clean rebuild with no build cache, which is useful if something behaves oddly:

```bash
docker compose build --no-cache && docker compose up -d
```

---

## 6. Run the tests

Run the backend xUnit tests. There are 58, including the 200-requests-for-120-seats concurrency test:

```bash
docker compose --profile test run --rm --build backend-tests
```

Show just the result summary:

```bash
docker compose --profile test run --rm --build backend-tests 2>&1 | grep -E "Passed!|Failed!|Total tests|Passed:|Failed:|\[FAIL\]"
```

Run the frontend tests. This needs Node.js 20 or newer on your machine:

```bash
cd frontend && npm install && npm test && cd ..
```

Or run the frontend tests with Docker only, without Node.js on your machine:

```bash
docker run --rm -v "$PWD/frontend":/app -v /app/node_modules -w /app node:22-alpine sh -c "npm ci && npm test"
```

---

## 7. Look inside the database and cache

Open a PostgreSQL shell (type `\q` to exit):

```bash
docker compose exec postgres psql -U admissions -d admissions
```

List classes with their seat usage:

```bash
docker compose exec postgres psql -U admissions -d admissions -c "SELECT c.name, c.total_seats, count(*) FILTER (WHERE h.status='HELD' AND h.expires_at > now()) AS held, count(*) FILTER (WHERE h.status='CONFIRMED') AS confirmed, count(*) FILTER (WHERE h.status='WAITLISTED') AS waitlist FROM classes c LEFT JOIN holds h ON h.class_id = c.id GROUP BY c.id ORDER BY c.grade, c.shift NULLS FIRST;"
```

Show the 20 most recent holds:

```bash
docker compose exec postgres psql -U admissions -d admissions -c "SELECT student_id, status, expires_at, created_at FROM holds ORDER BY created_at DESC LIMIT 20;"
```

Show what's in the Redis cache:

```bash
docker compose exec redis redis-cli keys '*'
```

---

## 8. Try the API from the terminal

Create a class (grade 1–12, shift `MORNING`, `DAY` or left out):

```bash
curl -s -X POST http://localhost:8080/classes -H "Content-Type: application/json" -d '{"grade":6,"shift":"MORNING","totalSeats":120}'
```

List classes:

```bash
curl -s http://localhost:8080/classes
```

To apply, replace `CLASS_ID` with an `id` from the list above:

```bash
curl -s -X POST http://localhost:8080/classes/CLASS_ID/holds -H "X-Student-Id: 20152691234567890"
```

When every seat is held, join the waitlist instead (you get the next free seat automatically):

```bash
curl -s -X POST http://localhost:8080/classes/CLASS_ID/waitlist -H "X-Student-Id: 20152691234567890"
```

List your applications:

```bash
curl -s http://localhost:8080/me/holds -H "X-Student-Id: 20152691234567890"
```

To mark a hold as paid, replace `HOLD_ID` with a `holdId` from the previous response:

```bash
curl -s -X POST http://localhost:8080/holds/HOLD_ID/confirm -H "X-Student-Id: 20152691234567890"
```

To cancel a hold, use the same `HOLD_ID`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:8080/holds/HOLD_ID -H "X-Student-Id: 20152691234567890"
```

---

## 9. Reset or remove everything

> ⚠️ The commands in this section **permanently delete** data. Nothing in this section can be undone.

Replace everything with the demo data (3 sessions, 24 classes, 300 students). See [seed/README.md](seed/README.md) for the options:

```bash
./seed/seed.sh seed -y
```

Delete all sessions, classes and applications, keeping the app running:

```bash
./seed/seed.sh reset -y
```

Stop the app and delete the database volume for a completely fresh start:

```bash
docker compose down -v
```

Remove everything this project created: containers, data and built images:

```bash
docker compose down -v --rmi local
```

Free disk space used by old Docker build cache. This affects **all** Docker projects on your machine:

```bash
docker builder prune -f
```

---

## 10. Troubleshooting

**"port is already allocated" (8080 or 3000 in use).** First, see what's using the ports:

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

```bash
lsof -iTCP:8080 -iTCP:3000 -sTCP:LISTEN -n -P
```

Or run the app on different ports instead. `API_URL` must match `API_PORT`:

```bash
API_PORT=18080 API_URL=http://localhost:18080 FRONTEND_PORT=3001 docker compose up --build -d
```

Then open http://localhost:3001.

**"Cannot connect to the Docker daemon".** Docker isn't running. Start Docker Desktop and wait for it to finish starting:

```bash
open -a Docker
```

On Linux, start the Docker service instead:

```bash
sudo systemctl start docker
```

**The frontend says "Server offline".** Check that the backend is running and healthy:

```bash
docker compose ps backend && curl -s http://localhost:8080/health
```

If the backend isn't running, look at the end of its logs to see why:

```bash
docker compose logs --tail 50 backend
```

**The backend keeps restarting.** It usually waits for the database. Check the database's health and logs:

```bash
docker compose ps postgres && docker compose logs --tail 30 postgres
```

**Code changes don't show up.** Rebuild the images:

```bash
docker compose up --build -d
```

**Seat counts look a second or two behind.** That's normal. The UI polls every 3 seconds and the API caches counts for 2 seconds. Seat limits themselves are always enforced exactly.

---

## Quick reference

| Task | Command |
| --- | --- |
| Start | `docker compose up --build -d` |
| Status | `docker compose ps` |
| All logs (live) | `docker compose logs -f` |
| Backend logs (live) | `docker compose logs -f backend` |
| Stop (keep data) | `docker compose down` |
| Restart | `docker compose restart` |
| Backend tests | `docker compose --profile test run --rm --build backend-tests` |
| Database shell | `docker compose exec postgres psql -U admissions -d admissions` |
| Load demo data (deletes data) | `./seed/seed.sh seed -y` |
| Show database contents | `./seed/seed.sh status` |
| Fresh start (deletes data) | `docker compose down -v` |
