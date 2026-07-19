-- Migration 019: Seed auto-trigger config for the attendance milestone (stage 18)
--
-- Migration 014 flagged stage 18 as is_auto_calculated, and migration 017
-- added the auto_trigger_config column — but no config was ever seeded, so
-- the column stayed NULL. Both the daily auto-completion job and the
-- on-demand evaluator skip any milestone whose config is missing or not
-- enabled (`config?.enabled`), which meant stage 18 was never ticked by the
-- scheduled safety net even once a convert reached the attendance goal.
--
-- Seed the config only where it is still NULL so an admin-customized config
-- is never overwritten. The threshold matches ATTENDANCE_GOAL (20) in
-- src/lib/constants.ts.

BEGIN;

UPDATE milestones
SET
  is_auto_calculated = TRUE,
  auto_trigger_config = '{
    "enabled": true,
    "logic": "AND",
    "conditions": [
      { "type": "attendance_count", "value": 20, "operator": "gte" }
    ]
  }'::jsonb
WHERE stage_number = 18
  AND auto_trigger_config IS NULL;

COMMIT;
