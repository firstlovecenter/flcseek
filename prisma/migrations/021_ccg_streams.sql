-- Migration 021: CCG streams
--
-- Adds the top level of the City Church Group structure:
--   stream → council → CCG → CCF
-- Councils belong to a stream. Roles can now be scoped to a stream, so a
-- stream-level role covers every council, CCG and CCF in it. No stream-level
-- role is seeded; add one as a row in ccg_roles when needed.
--
-- Apply after 020:  npx tsx scripts/ccg-apply-migration.ts prisma/migrations/021_ccg_streams.sql

BEGIN;

CREATE TABLE IF NOT EXISTS ccg_streams (
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

ALTER TABLE ccg_councils ADD COLUMN IF NOT EXISTS stream_id UUID REFERENCES ccg_streams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ccg_councils_stream ON ccg_councils(stream_id) WHERE deleted_at IS NULL;

-- Roles may be scoped to a stream.
ALTER TABLE ccg_roles DROP CONSTRAINT IF EXISTS ccg_roles_scope_level_check;
ALTER TABLE ccg_roles ADD CONSTRAINT ccg_roles_scope_level_check
  CHECK (scope_level IN ('global', 'stream', 'council', 'ccg', 'ccf'));

ALTER TABLE ccg_role_assignments ADD COLUMN IF NOT EXISTS stream_id UUID REFERENCES ccg_streams(id) ON DELETE CASCADE;
ALTER TABLE ccg_role_assignments DROP CONSTRAINT IF EXISTS ccg_role_assignments_one_unit;
ALTER TABLE ccg_role_assignments ADD CONSTRAINT ccg_role_assignments_one_unit
  CHECK (num_nonnulls(stream_id, council_id, ccg_id, ccf_id) <= 1);

DROP INDEX IF EXISTS ccg_role_assignments_open_unique;
CREATE UNIQUE INDEX ccg_role_assignments_open_unique
  ON ccg_role_assignments (user_id, role_key, COALESCE(stream_id, council_id, ccg_id, ccf_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE ends_on IS NULL;

COMMIT;
