-- Migration 029: Sheep Seekers own converts; AI help
--
-- * ccg_people.seeker_person_id: the Sheep Seeker (a member) who brought or
--   registered a convert. Intake links carry one too, so converts who register
--   themselves through a seeker's link are theirs.
-- * ccg_answers.other_text: what someone typed after choosing "Other";
--   ai_keys: options the AI added from that text (shown as such; staff can
--   remove them).
-- * ccg_people.connection_by_ai: the existing-connection member was matched by
--   the AI from the convert's note, not chosen by staff.
-- * ccg_placements.ai_summary: a short plain-English "why this CCF" line for
--   approvers; ai_summary_at is set when it was attempted (even if it failed),
--   so it is not retried on every page load.
--
-- Apply after 028:  npx tsx scripts/ccg-apply-migration.ts prisma/migrations/029_ccg_seekers_and_ai.sql

BEGIN;

ALTER TABLE ccg_people ADD COLUMN IF NOT EXISTS seeker_person_id UUID REFERENCES ccg_people(id) ON DELETE SET NULL;
ALTER TABLE ccg_people ADD COLUMN IF NOT EXISTS connection_by_ai BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_ccg_people_seeker ON ccg_people (seeker_person_id) WHERE deleted_at IS NULL;

ALTER TABLE ccg_form_links ADD COLUMN IF NOT EXISTS seeker_person_id UUID REFERENCES ccg_people(id) ON DELETE SET NULL;

ALTER TABLE ccg_answers ADD COLUMN IF NOT EXISTS other_text VARCHAR(200);
ALTER TABLE ccg_answers ADD COLUMN IF NOT EXISTS ai_keys JSONB;

ALTER TABLE ccg_placements ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE ccg_placements ADD COLUMN IF NOT EXISTS ai_summary_at TIMESTAMPTZ;

COMMIT;
