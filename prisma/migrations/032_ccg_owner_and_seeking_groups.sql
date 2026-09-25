-- Migration 032: the CCG owner; sheep seeking groups
--
-- * ccg_owners: the only Seek logins with full access to the CCG app (the
--   "super superadmin"). Other Seek superadmins no longer get CCG access just
--   for being superadmins. Seeded with skaduteye.
-- * ccg_seeking_groups: a stream's sheep seeking groups. Each convert belongs
--   to one (ccg_people.seeking_group_id); Sheep Seekers are assigned to groups
--   (ccg_seeking_group_seekers, by login) and look after every convert in them,
--   in whatever CCF they are placed. This replaces assigning converts to one
--   seeker each; ccg_people.seeker_person_id now just records who registered them.
--
-- Apply after 031:  npx tsx scripts/ccg-apply-migration.ts prisma/migrations/032_ccg_owner_and_seeking_groups.sql

BEGIN;

CREATE TABLE IF NOT EXISTS ccg_owners (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO ccg_owners (user_id)
  SELECT id FROM users WHERE lower(username) = 'skaduteye' AND deleted_at IS NULL
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS ccg_seeking_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id   UUID NOT NULL REFERENCES ccg_streams(id) ON DELETE CASCADE,
  code        VARCHAR(20) NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes       TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ccg_seeking_groups_stream ON ccg_seeking_groups(stream_id) WHERE deleted_at IS NULL;

ALTER TABLE ccg_people ADD COLUMN IF NOT EXISTS seeking_group_id UUID REFERENCES ccg_seeking_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ccg_people_seeking_group ON ccg_people(seeking_group_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ccg_seeking_group_seekers (
  group_id     UUID NOT NULL REFERENCES ccg_seeking_groups(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ccg_seeking_group_seekers_user ON ccg_seeking_group_seekers(user_id);

COMMIT;
