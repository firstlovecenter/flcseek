-- Migration 034: CCGs sit directly under streams (step 1 of 2, additive)
--
--   campus → stream → CCG → CCF
--
-- Each CCG takes its council's stream. The Overseer role moves from council to
-- stream level, and any council-level assignments become assignments on that
-- council's stream. Councils themselves are removed in 035, once code that no
-- longer reads them is live. Safe to run before that code deploys.

BEGIN;

ALTER TABLE ccg_groups ADD COLUMN IF NOT EXISTS stream_id UUID REFERENCES ccg_streams(id);
CREATE INDEX IF NOT EXISTS idx_ccg_groups_stream ON ccg_groups(stream_id) WHERE deleted_at IS NULL;

UPDATE ccg_groups g SET stream_id = c.stream_id
  FROM ccg_councils c
 WHERE c.id = g.council_id AND g.stream_id IS NULL;

UPDATE ccg_roles SET scope_level = 'stream',
       description = 'Oversees every CCG in a stream: reads and reports across them, and follows converts through milestones and check-ins.',
       updated_at = NOW()
 WHERE key = 'overseer';

UPDATE ccg_role_assignments a SET stream_id = c.stream_id, council_id = NULL
  FROM ccg_councils c
 WHERE c.id = a.council_id AND c.stream_id IS NOT NULL;

COMMIT;
