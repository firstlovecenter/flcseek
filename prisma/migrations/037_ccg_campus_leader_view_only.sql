-- Migration 037: Campus Leader is a view-only role
--
-- They see every stream in their campus on both sides (people, placements,
-- progress and reports) but change nothing.

BEGIN;

UPDATE ccg_roles
   SET permissions = ARRAY['people.view', 'placements.view', 'reports.view'],
       description = 'Sees every stream in their campus, in City Church Groups and Sheep Seeking: people, placements, progress and reports. View only.',
       updated_at = NOW()
 WHERE key = 'campus_leader';

COMMIT;
