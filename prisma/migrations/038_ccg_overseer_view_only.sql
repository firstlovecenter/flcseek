-- Migration 038: the Overseer (a stream's leader, City Church Groups side) is a view-only role
--
-- They see every CCG and CCF in their stream (people, placements, progress and
-- reports) but change nothing.

BEGIN;

UPDATE ccg_roles
   SET permissions = ARRAY['people.view', 'placements.view', 'reports.view'],
       description = 'Leads a stream on the City Church Groups side: sees every CCG and CCF in it (people, placements, progress and reports). View only.',
       updated_at = NOW()
 WHERE key = 'overseer';

COMMIT;
