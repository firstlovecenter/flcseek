-- Migration 027: first, middle and last names taken separately
--
-- People's names are captured as first name, middle name (optional) and last
-- name. full_name is kept, written by the app from the parts, for display,
-- search and sorting.
--
-- Existing rows are split from full_name: first word → first_name, last word
-- → last_name, anything between → middle_name. A one-word name keeps only a
-- first name; edit those records to add the last name.
--
-- Apply after 026:  npx tsx scripts/ccg-apply-migration.ts prisma/migrations/027_ccg_person_names.sql

BEGIN;

ALTER TABLE ccg_people ADD COLUMN IF NOT EXISTS first_name  VARCHAR(80);
ALTER TABLE ccg_people ADD COLUMN IF NOT EXISTS middle_name VARCHAR(80);
ALTER TABLE ccg_people ADD COLUMN IF NOT EXISTS last_name   VARCHAR(80);

UPDATE ccg_people SET
  first_name  = split_part(btrim(full_name), ' ', 1),
  last_name   = CASE WHEN btrim(full_name) ~ '\s' THEN regexp_replace(btrim(full_name), '^.*\s', '') END,
  middle_name = NULLIF(btrim(regexp_replace(regexp_replace(btrim(full_name), '^\S+\s*', ''), '\s*\S+$', '')), '')
WHERE first_name IS NULL;

ALTER TABLE ccg_people ALTER COLUMN first_name SET NOT NULL;

COMMIT;
