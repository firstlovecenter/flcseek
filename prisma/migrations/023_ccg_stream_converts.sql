-- Migration 023: converts belong to a stream; Sheep Seekers are stream-level
--
-- Sheep Seekers register converts and handle their mapping for one stream.
-- A convert is registered into a stream (by a Sheep Seeker, or through a
-- stream's intake link), is matched only against CCFs in that stream, and is
-- visible to that stream's Sheep Seekers. A convert with no stream is
-- church-wide and handled by global roles.
--
-- Apply after 022:  npx tsx scripts/ccg-apply-migration.ts prisma/migrations/023_ccg_stream_converts.sql

BEGIN;

ALTER TABLE ccg_people ADD COLUMN IF NOT EXISTS stream_id UUID REFERENCES ccg_streams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ccg_people_stream ON ccg_people(stream_id) WHERE deleted_at IS NULL;

ALTER TABLE ccg_form_links ADD COLUMN IF NOT EXISTS stream_id UUID REFERENCES ccg_streams(id) ON DELETE CASCADE;

UPDATE ccg_roles SET scope_level = 'stream',
  description = 'Registers converts and handles their mapping into CCFs in a stream; marks attendance and follows up milestones.',
  updated_at = NOW()
  WHERE key = 'sheep_seeker';

-- Any church-wide Sheep Seeker assignment no longer grants anything: end it.
UPDATE ccg_role_assignments SET ends_on = CURRENT_DATE
  WHERE role_key = 'sheep_seeker' AND stream_id IS NULL AND (ends_on IS NULL OR ends_on > CURRENT_DATE);

COMMIT;
