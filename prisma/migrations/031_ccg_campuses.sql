-- Migration 031: campuses, above streams
--
--   campus → stream → council → CCG → CCF
--
-- A campus groups streams. Its Campus Leader (like Seek's Lead Pastor) sees
-- and runs everything in its streams, on both sides (City Church Groups and
-- Sheep Seeking), but not the structure, roles or settings. Streams without a
-- campus keep working as before.
--
-- Apply after 030:  npx tsx scripts/ccg-apply-migration.ts prisma/migrations/031_ccg_campuses.sql

BEGIN;

CREATE TABLE IF NOT EXISTS ccg_campuses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(20) NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes       TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

ALTER TABLE ccg_streams ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES ccg_campuses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ccg_streams_campus ON ccg_streams(campus_id) WHERE deleted_at IS NULL;

-- Roles may be scoped to a campus.
ALTER TABLE ccg_roles DROP CONSTRAINT IF EXISTS ccg_roles_scope_level_check;
ALTER TABLE ccg_roles ADD CONSTRAINT ccg_roles_scope_level_check
  CHECK (scope_level IN ('global', 'campus', 'stream', 'council', 'ccg', 'ccf'));

ALTER TABLE ccg_role_assignments ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES ccg_campuses(id) ON DELETE CASCADE;
ALTER TABLE ccg_role_assignments DROP CONSTRAINT IF EXISTS ccg_role_assignments_one_unit;
ALTER TABLE ccg_role_assignments ADD CONSTRAINT ccg_role_assignments_one_unit
  CHECK (num_nonnulls(campus_id, stream_id, council_id, ccg_id, ccf_id) <= 1);

DROP INDEX IF EXISTS ccg_role_assignments_open_unique;
CREATE UNIQUE INDEX ccg_role_assignments_open_unique
  ON ccg_role_assignments (user_id, role_key, COALESCE(campus_id, stream_id, council_id, ccg_id, ccf_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE ends_on IS NULL;

INSERT INTO ccg_roles (key, name, description, scope_level, permissions, is_system, sort_order) VALUES
  ('campus_leader', 'Campus Leader',
   'Leads a campus (like Seek''s Lead Pastor): sees and runs everything in its streams, in City Church Groups and Sheep Seeking. Not the structure, roles or settings.',
   'campus',
   ARRAY['units.edit','people.view','people.manage','members.confirm','links.manage','links.intake','placements.view','placements.approve',
         'milestones.update','attendance.mark','activities.record','checkins.record','reports.view','seekers.manage'], TRUE, 1)
ON CONFLICT (key) DO NOTHING;

COMMIT;
