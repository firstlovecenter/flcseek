-- Migration 030: each stream's Sheep Seeking Overseer
--
-- Every stream has its own head of sheep seeking, in charge of everything
-- sheep seeking in that stream: its Sheep Seekers (appointing them and
-- assigning converts to them), registration, mapping and approvals, and the
-- converts' milestones. They lead the stream (shown as its leader).
--
-- New permission seekers.manage: appoint and stand down Sheep Seekers, and
-- assign converts to them, in scope. The CCG Admin gets it too; the Seek
-- superadmin holds every permission anyway.
--
-- Apply after 029:  npx tsx scripts/ccg-apply-migration.ts prisma/migrations/030_ccg_seeking_overseer.sql

BEGIN;

INSERT INTO ccg_roles (key, name, description, scope_level, permissions, is_system, sort_order) VALUES
  ('seeking_overseer', 'Sheep Seeking Overseer',
   'Heads sheep seeking in a stream: appoints its Sheep Seekers and assigns converts to them; registration, mapping, approvals and milestones across the stream.',
   'stream',
   ARRAY['people.view','people.manage','links.intake','placements.view','placements.approve',
         'attendance.mark','milestones.update','checkins.record','reports.view','seekers.manage'], TRUE, 4)
ON CONFLICT (key) DO NOTHING;

UPDATE ccg_roles SET permissions = ARRAY(SELECT DISTINCT unnest(permissions || ARRAY['seekers.manage'])), updated_at = NOW()
  WHERE key = 'ccg_admin';

UPDATE ccg_roles SET description = 'Looks after the converts assigned to them, across their CCFs: registers converts, handles their mapping, and ticks their milestones.', updated_at = NOW()
  WHERE key = 'sheep_seeker';

COMMIT;
