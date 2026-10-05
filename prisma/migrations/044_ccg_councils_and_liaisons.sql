-- Migration 044: councils come back; Sheep Seeking Liaisons (step 1 of 2, additive)
--
--   campus → stream → council → CCG → CCF
--
-- * ccg_councils: a stream's councils. A CCG may sit in a council of its own
--   stream (ccg_groups.council_id); ccg_groups.stream_id stays, and always
--   matches its council's stream. Existing CCGs have no council until one is chosen.
-- * Council Admin (council, City Church Groups side): runs a council's CCGs and
--   CCFs, members included, like the Stream Admin does for a stream.
-- * ccg_seeking_liaisons: Sheep Seekers assigned to CCFs of their stream. The
--   converts placed in those CCFs are theirs to follow, as they are the CCF
--   Coordinator's. This replaces sheep seeking groups (dropped in 045): every
--   convert belongs to the stream that registered it, not to a Sheep Seeker.
--
-- Safe to run before the code that uses it deploys.

BEGIN;

CREATE TABLE IF NOT EXISTS ccg_councils (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id   UUID NOT NULL REFERENCES ccg_streams(id),
  code        VARCHAR(20) NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes       TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ccg_councils_stream ON ccg_councils(stream_id) WHERE deleted_at IS NULL;

ALTER TABLE ccg_groups ADD COLUMN IF NOT EXISTS council_id UUID REFERENCES ccg_councils(id);
CREATE INDEX IF NOT EXISTS idx_ccg_groups_council ON ccg_groups(council_id) WHERE deleted_at IS NULL;

ALTER TABLE ccg_role_assignments ADD COLUMN IF NOT EXISTS council_id UUID REFERENCES ccg_councils(id) ON DELETE CASCADE;
ALTER TABLE ccg_role_assignments DROP CONSTRAINT IF EXISTS ccg_role_assignments_one_unit;
ALTER TABLE ccg_role_assignments ADD CONSTRAINT ccg_role_assignments_one_unit
  CHECK (num_nonnulls(campus_id, stream_id, council_id, ccg_id, ccf_id) <= 1);
DROP INDEX IF EXISTS ccg_role_assignments_open_unique;
CREATE UNIQUE INDEX ccg_role_assignments_open_unique
  ON ccg_role_assignments (user_id, role_key, COALESCE(campus_id, stream_id, council_id, ccg_id, ccf_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE ends_on IS NULL;

ALTER TABLE ccg_roles DROP CONSTRAINT IF EXISTS ccg_roles_scope_level_check;
ALTER TABLE ccg_roles ADD CONSTRAINT ccg_roles_scope_level_check
  CHECK (scope_level IN ('global', 'campus', 'stream', 'council', 'ccg', 'ccf'));

INSERT INTO ccg_roles (key, name, description, scope_level, permissions, is_system, sort_order) VALUES
  ('council_admin', 'Council Admin',
   'Runs a council on the City Church Groups side: every CCG and CCF in it, including editing, transferring and removing members.',
   'council',
   ARRAY['units.edit','people.view','people.manage','members.confirm','members.edit','links.manage','placements.view',
         'attendance.mark','milestones.update','checkins.record','activities.record','reports.view'],
   TRUE, 3)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS ccg_seeking_liaisons (
  ccf_id       UUID NOT NULL REFERENCES ccg_families(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (ccf_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ccg_seeking_liaisons_user ON ccg_seeking_liaisons(user_id);

UPDATE ccg_roles
   SET description = 'Registers converts into a stream and handles their mapping into CCFs; marks attendance and follows up milestones. As a liaison, follows the converts placed in the CCFs assigned to them.',
       updated_at = NOW()
 WHERE key = 'sheep_seeker';

COMMIT;
