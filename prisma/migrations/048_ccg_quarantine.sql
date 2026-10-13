-- Migration 048: quarantine for converts who already belong to a Bacenta (additive)
--
-- Some converts already belong to a Bacenta, so they don't qualify for a CCF,
-- though some have been placed in one. Their CCF Coordinator (or the leaders
-- and admins above, or a Sheep Seeking role) quarantines them:
--
-- * A placed convert leaves the CCF at once: their placement becomes
--   'quarantined' (off the CCF's lists, milestones, attendance and convert
--   count), keeping its progress in case they are released. A convert not yet
--   placed has their proposal set aside ('superseded').
-- * The convert's status becomes 'quarantined'.
-- * The stream's or campus's Sheep Seeking Admin (seekers.manage) decides:
--     confirm  belongs to a Bacenta: the placement ends with outcome 'bacenta',
--              the convert's status becomes 'bacenta' (read-only, for statistics)
--     release  back to the same CCF, progress kept (or back to matching, if
--              they had not been placed)
--     replace  placed again elsewhere: matched afresh, as a new convert is
-- * ccg_quarantines keeps every case and who did what. No one is notified.
--
-- Only widens status lists and adds a table: safe before the code deploys.

BEGIN;

ALTER TABLE ccg_placements DROP CONSTRAINT IF EXISTS ccg_placements_status_check;
ALTER TABLE ccg_placements ADD CONSTRAINT ccg_placements_status_check
  CHECK (status IN ('proposed', 'held', 'active', 'ended', 'superseded', 'quarantined'));

ALTER TABLE ccg_placements DROP CONSTRAINT IF EXISTS ccg_placements_outcome_check;
ALTER TABLE ccg_placements ADD CONSTRAINT ccg_placements_outcome_check
  CHECK (outcome IS NULL OR outcome IN ('graduated', 'made_member', 'ended', 'bacenta'));

ALTER TABLE ccg_people DROP CONSTRAINT IF EXISTS ccg_people_status;
ALTER TABLE ccg_people ADD CONSTRAINT ccg_people_status CHECK (
  (kind = 'member'  AND status IN ('pending', 'active', 'inactive')) OR
  (kind = 'convert' AND status IN ('new', 'proposed', 'needs_info', 'placed', 'integrated', 'inactive', 'quarantined', 'bacenta'))
);

CREATE TABLE IF NOT EXISTS ccg_quarantines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     UUID NOT NULL REFERENCES ccg_people(id) ON DELETE CASCADE,
  -- The placement they were in (quarantined) or proposed for; null if none.
  placement_id  UUID REFERENCES ccg_placements(id) ON DELETE SET NULL,
  -- The CCF they were placed in, if they were placed.
  ccf_id        UUID REFERENCES ccg_families(id) ON DELETE SET NULL,
  stream_id     UUID REFERENCES ccg_streams(id) ON DELETE SET NULL,
  -- The status they had before (to release a convert who was not placed).
  prior_status  VARCHAR(20) NOT NULL,
  reason        TEXT NOT NULL,
  status        VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'released', 'replaced')),
  flagged_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  flagged_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at    TIMESTAMPTZ,
  decision_note TEXT
);
-- One open case per convert.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ccg_quarantines_open ON ccg_quarantines(person_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_ccg_quarantines_stream ON ccg_quarantines(stream_id, status);

COMMIT;
