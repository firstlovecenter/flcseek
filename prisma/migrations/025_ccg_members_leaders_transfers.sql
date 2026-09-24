-- Migration 025: graduation, leaders from members, transfers
--
--  * A convert who reaches every milestone in their assessment year becomes a
--    member of their CCF (placement outcome 'graduated'). Placements record
--    how they ended in `outcome`, for reporting and for learning which matches
--    work.
--  * Leaders come from members: a member can be linked to a login
--    (ccg_people.user_id). CCF, CCG and council leader roles need one.
--  * Converts and members can be transferred to another CCF (the smallest unit
--    anyone belongs to); every move is kept in ccg_transfers.
--
-- Apply after 024:  npx tsx scripts/ccg-apply-migration.ts prisma/migrations/025_ccg_members_leaders_transfers.sql

BEGIN;

ALTER TABLE ccg_placements ADD COLUMN IF NOT EXISTS outcome VARCHAR(12);
ALTER TABLE ccg_placements DROP CONSTRAINT IF EXISTS ccg_placements_outcome_check;
ALTER TABLE ccg_placements ADD CONSTRAINT ccg_placements_outcome_check
  CHECK (outcome IS NULL OR outcome IN ('graduated', 'made_member', 'ended'));
-- Backfill placements ended before this migration.
UPDATE ccg_placements SET outcome = CASE WHEN end_reason = 'Became a member of the CCF' THEN 'made_member' ELSE 'ended' END
  WHERE status = 'ended' AND outcome IS NULL;

ALTER TABLE ccg_people ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ccg_people_user_unique ON ccg_people(user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ccg_transfers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       UUID NOT NULL REFERENCES ccg_people(id) ON DELETE CASCADE,
  kind            VARCHAR(10) NOT NULL CHECK (kind IN ('member', 'convert')),
  placement_id    UUID REFERENCES ccg_placements(id) ON DELETE SET NULL,
  from_ccf_id     UUID REFERENCES ccg_families(id) ON DELETE SET NULL,
  to_ccf_id       UUID NOT NULL REFERENCES ccg_families(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL,
  over_capacity   BOOLEAN NOT NULL DEFAULT FALSE,
  transferred_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ccg_transfers_person ON ccg_transfers(person_id, created_at DESC);

COMMIT;
