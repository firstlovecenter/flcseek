-- Migration 018: Attendance uniqueness + JWT revocation support
--
-- 1. Deduplicate attendance_records, then enforce uniqueness on
--    (person_id, date_attended) so the same person can never be marked
--    present twice for the same service. Duplicates inflate the 26-week
--    attendance goal and the attendance-count milestone auto-triggers.
--
-- 2. Add users.token_version for instant JWT revocation. Bumping the
--    version invalidates every outstanding token for that user (used on
--    password reset, deactivation, role change).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1a. Remove duplicate attendance rows, keeping the earliest-created record
--     for each (person_id, date_attended) pair.
-- ---------------------------------------------------------------------------
DELETE FROM attendance_records a
USING attendance_records b
WHERE a.person_id = b.person_id
  AND a.date_attended = b.date_attended
  AND (
    a.created_at > b.created_at
    OR (a.created_at = b.created_at AND a.id > b.id)
    OR (a.created_at IS NULL AND b.created_at IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- 1b. Enforce uniqueness going forward.
-- ---------------------------------------------------------------------------
ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_person_date_unique UNIQUE (person_id, date_attended);

-- ---------------------------------------------------------------------------
-- 2. Token versioning for JWT revocation.
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

COMMIT;
