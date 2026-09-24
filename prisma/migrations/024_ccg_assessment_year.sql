-- Migration 024: one-year assessment; 10 Sundays
--
-- Each convert is assessed over one year from the approval of their placement:
-- every milestone falls due within that year. The Sunday milestone is ten
-- Sundays, not twenty. Idempotent: databases seeded by the current 022 are
-- already in this state.
--
-- After applying, re-sync auto milestones (the Sunday target changed):
--   npx tsx scripts/ccg-sync-milestones.ts
--
-- Apply after 023:  npx tsx scripts/ccg-apply-migration.ts prisma/migrations/024_ccg_assessment_year.sql

BEGIN;

UPDATE ccg_milestones SET
  name = 'Tenth Sunday',
  short_name = '10 Sundays',
  attendance_target = 10,
  description = 'Attended 10 Sunday services.',
  guidance = REPLACE(guidance, 'the twentieth (20) Sunday', 'the tenth (10) Sunday'),
  updated_at = NOW()
WHERE kind = 'attendance' AND attendance_event = 'sunday_service' AND attendance_target = 20;

UPDATE ccg_milestones SET target_days = 365, updated_at = NOW() WHERE target_days IS NULL OR target_days > 365;

COMMIT;
