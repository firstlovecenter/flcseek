-- Migration 035: remove the council level (step 2 of 2)
--
-- Run only after 034 and after the code without councils is deployed.
-- Catches any CCG created by old code between the two steps, then drops
-- councils and every reference to them.

BEGIN;

UPDATE ccg_groups g SET stream_id = c.stream_id
  FROM ccg_councils c
 WHERE c.id = g.council_id AND g.stream_id IS NULL;

UPDATE ccg_role_assignments a SET stream_id = c.stream_id, council_id = NULL
  FROM ccg_councils c
 WHERE c.id = a.council_id AND c.stream_id IS NOT NULL;

ALTER TABLE ccg_groups ALTER COLUMN stream_id SET NOT NULL;
ALTER TABLE ccg_groups DROP COLUMN council_id;

-- Dropping council_id also drops the one-unit check and the open-assignment
-- unique index that mention it; recreate both without it.
ALTER TABLE ccg_role_assignments DROP COLUMN council_id;
ALTER TABLE ccg_role_assignments ADD CONSTRAINT ccg_role_assignments_one_unit
  CHECK (num_nonnulls(campus_id, stream_id, ccg_id, ccf_id) <= 1);
CREATE UNIQUE INDEX ccg_role_assignments_open_unique
  ON ccg_role_assignments (user_id, role_key, COALESCE(campus_id, stream_id, ccg_id, ccf_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE ends_on IS NULL;

ALTER TABLE ccg_roles DROP CONSTRAINT IF EXISTS ccg_roles_scope_level_check;
ALTER TABLE ccg_roles ADD CONSTRAINT ccg_roles_scope_level_check
  CHECK (scope_level IN ('global', 'campus', 'stream', 'ccg', 'ccf'));

DROP TABLE ccg_councils;

COMMIT;
