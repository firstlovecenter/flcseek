-- Migration 045: remove sheep seeking groups (step 2 of 2)
--
-- Run only after 044 and after the code without seeking groups is deployed.
-- Converts already belong to their stream (ccg_people.stream_id); the group
-- only narrowed which Sheep Seekers followed them. Sheep Seeking Liaisons
-- (ccg_seeking_liaisons, by CCF) take that over.

BEGIN;

ALTER TABLE ccg_people DROP COLUMN IF EXISTS seeking_group_id;
DROP TABLE IF EXISTS ccg_seeking_group_seekers;
DROP TABLE IF EXISTS ccg_seeking_groups;

COMMIT;
