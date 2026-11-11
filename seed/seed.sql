-- =============================================================================
-- School Admission System — demo seed
--
-- Replaces ALL data with a realistic, repeatable demo dataset:
--   * 3 academic sessions: 2025 ARCHIVED, 2026 ACTIVE, 2027 UPCOMING
--   * 24 classes: 2025 grades 1–3, 2026 grades 1–6, 2027 grades 1–3 (Morning + Day)
--   * 300 students with 17-digit Birth Registration Numbers
--       2025: 100 CONFIRMED
--       2026: 140 CONFIRMED, 35 HELD (live payment timers), 25 WAITLISTED
--     Class 1 and Class 2 (both shifts) of 2026 are exactly full, with the
--     waitlist queued behind them.
--
-- The same IDs and names are produced on every run.
--
-- Options (psql variables, all optional):
--   hold_for  how long the 35 HELD seats stay payable     default '8 minutes'
--   opens_in  when the 2027 session opens automatically   default '7 days'
--
-- Normally run through ./seed/seed.sh. Direct use:
--   docker compose exec -T postgres psql -U admissions -d admissions \
--     -v ON_ERROR_STOP=1 -v hold_for='8 minutes' -v opens_in='7 days' < seed/seed.sql
--
-- The tables must already exist: the backend creates them on startup.
-- =============================================================================

\set ON_ERROR_STOP on
\if :{?hold_for}
\else
  \set hold_for '8 minutes'
\endif
\if :{?opens_in}
\else
  \set opens_in '7 days'
\endif

-- Reject bad options before touching any data.
SELECT :'hold_for'::interval > interval '0' AS hold_for_ok,
       :'opens_in'::interval > interval '0' AS opens_in_ok \gset
\if :hold_for_ok
\else
  DO $$ BEGIN RAISE EXCEPTION 'hold_for must be a positive interval, e.g. ''8 minutes'''; END $$;
\endif
\if :opens_in_ok
\else
  DO $$ BEGIN RAISE EXCEPTION 'opens_in must be a positive interval, e.g. ''7 days'''; END $$;
\endif

BEGIN;

TRUNCATE TABLE holds, classes, academic_sessions RESTART IDENTITY CASCADE;

-- 1. Academic sessions ---------------------------------------------------------
INSERT INTO academic_sessions (academic_year, title, status, starts_at, created_at, archived_at, notes) VALUES
  (2025, 'Academic Session 2025–2026', 'ARCHIVED', NULL,
   now() - interval '1 year', now() - interval '6 months',
   'Completed historical admission cycle. Retains confirmed admitted students only.'),
  (2026, 'Academic Session 2026–2027', 'ACTIVE', NULL,
   now() - interval '3 months', NULL,
   'Current active admission session. Online seat holds and waitlist queues are live.'),
  (2027, 'Academic Session 2027–2028', 'UPCOMING', now() + :'opens_in'::interval,
   now() - interval '2 days', NULL,
   'Official 2027–2028 admission cycle. Applications open automatically on scheduled launch date.');

-- 2. Classes ---------------------------------------------------------------------
-- Class n of a year has id <prefix>-0000-0000-0000-<n>; odd n = Morning, even n = Day.
WITH years (academic_year, id_prefix, grades, seats, created_at) AS (
  VALUES
    (2025, '11111111', 3, ARRAY[40, 35, 30],             now() - interval '1 year'),
    (2026, '22222222', 6, ARRAY[25, 25, 25, 25, 25, 25], now() - interval '3 months'),
    (2027, '33333333', 3, ARRAY[50, 40, 35],             now() - interval '1 day')
)
INSERT INTO classes (id, academic_year, grade, shift, name, total_seats, created_at)
SELECT (y.id_prefix || '-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       y.academic_year,
       (n + 1) / 2,
       CASE WHEN n % 2 = 1 THEN 'MORNING' ELSE 'DAY' END,
       'Class ' || (n + 1) / 2 || CASE WHEN n % 2 = 1 THEN ' - Morning Shift' ELSE ' - Day Shift' END,
       y.seats[(n + 1) / 2],
       y.created_at
FROM years y
CROSS JOIN LATERAL generate_series(1, y.grades * 2) AS n
ORDER BY y.academic_year, n;

-- 3. Students -------------------------------------------------------------------
-- Each cohort is a range of student numbers spread round-robin over a range of
-- classes. Names come from fixed lists, so they are the same on every run.
WITH
first_names (list) AS (VALUES (ARRAY[
  'Liam','Emma','Noah','Olivia','William','Ava','James','Isabella','Oliver','Sophia',
  'Benjamin','Charlotte','Elijah','Mia','Lucas','Amelia','Mason','Harper','Logan','Evelyn',
  'Alexander','Abigail','Ethan','Emily','Jacob','Elizabeth','Michael','Mila','Daniel','Ella',
  'Henry','Avery','Jackson','Sofia','Sebastian','Camila','Aiden','Aria','Matthew','Scarlett',
  'Samuel','Victoria','David','Madison','Joseph','Luna','Carter','Grace','Owen','Chloe',
  'Wyatt','Penelope','John','Layla','Jack','Riley','Luke','Zoey','Jayden','Nora',
  'Dylan','Lily','Grayson','Eleanor','Levi','Hannah','Isaac','Lillian','Gabriel','Addison',
  'Julian','Aubrey','Mateo','Ellie','Anthony','Stella','Jaxon','Natalie','Lincoln','Zoe',
  'Joshua','Leah','Christopher','Hazel','Andrew','Violet','Theodore','Aurora','Caleb','Savannah',
  'Ryan','Audrey','Asher','Brooklyn','Nathan','Bella','Thomas','Claire','Leo','Skylar'])),
last_names (list) AS (VALUES (ARRAY[
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
  'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin',
  'Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson',
  'Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores',
  'Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts'])),
cohorts (first_no, last_no, academic_year, status, first_class, class_count, first_mul, last_mul) AS (
  VALUES
    (  1, 100, 2025, 'CONFIRMED',  1, 6, 7, 13),  -- 2025: spread over all 6 classes
    (101, 180, 2026, 'CONFIRMED',  1, 4, 3, 11),  -- 2026 Class 1–2: 20 confirmed each
    (181, 240, 2026, 'CONFIRMED',  5, 8, 3, 11),  -- 2026 Class 3–6: 7–8 confirmed each
    (241, 260, 2026, 'HELD',       1, 4, 5, 17),  -- 2026 Class 1–2: +5 held each = full
    (261, 275, 2026, 'HELD',       5, 8, 5, 17),  -- 2026 Class 3–6: 1–2 held each
    (276, 300, 2026, 'WAITLISTED', 1, 4, 2, 19)   -- queued behind the full classes
),
students AS (
  SELECT s.no, c.academic_year, c.status,
         c.first_class + (s.no - c.first_no) % c.class_count AS class_no,
         c.first_mul, c.last_mul
  FROM cohorts c
  CROSS JOIN LATERAL generate_series(c.first_no, c.last_no) AS s(no)
),
timed AS (
  SELECT st.*,
         CASE
           WHEN st.academic_year = 2025 THEN now() - interval '10 months' + (st.no % 30) * interval '1 day'
           WHEN st.status = 'CONFIRMED'  THEN now() - interval '20 days' + (st.no % 48) * interval '1 hour'
           WHEN st.status = 'HELD'       THEN now() - interval '2 minutes'
           ELSE now() - interval '5 minutes' + (st.no - 276) * interval '1 second'
         END AS applied_at
  FROM students st
)
INSERT INTO holds (id, class_id, student_id, status, expires_at, created_at, confirmed_at, cancelled_at,
                   academic_year, student_name, age)
SELECT ('a0000000-0000-0000-0000-' || lpad(t.no::text, 12, '0'))::uuid,
       (CASE t.academic_year WHEN 2025 THEN '11111111' ELSE '22222222' END
          || '-0000-0000-0000-' || lpad(t.class_no::text, 12, '0'))::uuid,
       '201526910000' || lpad(t.no::text, 5, '0'),
       t.status,
       CASE t.status
         WHEN 'CONFIRMED' THEN t.applied_at + interval '10 minutes'  -- paid inside the hold window
         WHEN 'HELD'      THEN now() + :'hold_for'::interval
       END,
       t.applied_at,
       CASE WHEN t.status = 'CONFIRMED' THEN t.applied_at + interval '4 minutes' END,
       NULL,
       t.academic_year,
       fn.list[(t.no * t.first_mul) % 100 + 1] || ' ' || ln.list[(t.no * t.last_mul) % 50 + 1],
       (t.class_no + 1) / 2 + 5  -- grade + 5, e.g. Class 1 → age 6
FROM timed t, first_names fn, last_names ln
ORDER BY t.no;  -- queue numbers follow student order, so the waitlist is first come, first served

-- 4. Safety check: no class may hold more students than it has seats.
DO $$
DECLARE overbooked text;
BEGIN
  SELECT string_agg(c.academic_year || ' ' || c.name, ', ') INTO overbooked
  FROM classes c
  WHERE c.total_seats < (SELECT count(*) FROM holds h
                         WHERE h.class_id = c.id AND h.status IN ('HELD', 'CONFIRMED'));
  IF overbooked IS NOT NULL THEN
    RAISE EXCEPTION 'Seed would overbook: %', overbooked;
  END IF;
END $$;

COMMIT;

-- 5. Summary ---------------------------------------------------------------------
SELECT s.academic_year AS year,
       s.status        AS session,
       (SELECT count(*) FROM classes c WHERE c.academic_year = s.academic_year)                           AS classes,
       (SELECT coalesce(sum(total_seats), 0) FROM classes c WHERE c.academic_year = s.academic_year)       AS seats,
       (SELECT count(*) FROM holds h WHERE h.academic_year = s.academic_year AND h.status = 'CONFIRMED')  AS confirmed,
       (SELECT count(*) FROM holds h WHERE h.academic_year = s.academic_year AND h.status = 'HELD')       AS held,
       (SELECT count(*) FROM holds h WHERE h.academic_year = s.academic_year AND h.status = 'WAITLISTED') AS waitlisted
FROM academic_sessions s
ORDER BY s.academic_year;
