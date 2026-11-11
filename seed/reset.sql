-- =============================================================================
-- School Admission System — empty reset
--
-- Deletes ALL data and leaves one empty ACTIVE 2026 session, the same state
-- as the admin "Reset database" button (POST /admin/reset).
--
-- Normally run through ./seed/seed.sh reset.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

TRUNCATE TABLE holds, classes, academic_sessions RESTART IDENTITY CASCADE;

INSERT INTO academic_sessions (academic_year, title, status, created_at)
VALUES (2026, 'Academic Session 2026–2027', 'ACTIVE', now());

COMMIT;
