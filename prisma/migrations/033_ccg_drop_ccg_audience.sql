-- Migration 033: drop ccg_groups.audience
--
-- Matching is based on profiles alone (the CCF members' answers against the
-- convert's); a CCG no longer has an adults/youth audience. (The question
-- bank's own `audience` column, which says who a question is asked of, stays.)
--
-- Apply after 032:  npx tsx scripts/ccg-apply-migration.ts prisma/migrations/033_ccg_drop_ccg_audience.sql

BEGIN;

ALTER TABLE ccg_groups DROP COLUMN IF EXISTS audience;

COMMIT;
