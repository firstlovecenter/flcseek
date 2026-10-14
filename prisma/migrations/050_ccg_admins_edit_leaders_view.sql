-- Migration 050: admins edit, leaders view
--
-- * Creating and editing groups is no longer the central team's alone: a unit's
--   admins (and the admins above it) add groups inside it and edit their details
--   (units.edit). Moving a group to another parent, deleting it, and campuses stay
--   with the central team. Leaders only view: the CCG's Overseer and the Council
--   Leader lose units.edit (the Stream and Campus Leaders never had it).
-- * Editing, transferring and removing existing CCF members (members.edit) is for
--   admins too: City Church Admins gain it, Council Leaders lose it. Overseers
--   never had it.
-- * Leaders keep their day-to-day work (attendance, milestones, check-ins,
--   registering converts and members) and keep appointing (admins.appoint,
--   leaders.appoint). CCF Coordinators are unchanged: a CCF has no admins.
--
-- No assignment or other row changes; only these three ccg_roles rows.
BEGIN;

UPDATE ccg_roles
   SET permissions = array_remove(array_remove(permissions, 'units.edit'), 'members.edit'), updated_at = NOW()
 WHERE key IN ('ccg_governor', 'council_leader')
   AND (permissions && ARRAY['units.edit', 'members.edit']);

UPDATE ccg_roles
   SET permissions = array_append(permissions, 'members.edit'), updated_at = NOW()
 WHERE key = 'ccg_group_admin'
   AND NOT ('members.edit' = ANY (permissions));

UPDATE ccg_roles
   SET description = 'Leads one CCG and its CCFs: sees everything in it, marks attendance, records milestones and check-ins, registers converts and members. Appoints its City Church Admins; its admins add and edit CCFs and edit members.',
       updated_at = NOW()
 WHERE key = 'ccg_governor';

UPDATE ccg_roles
   SET description = 'Leads a council on the City Church Groups side: sees every CCG and CCF in it and does their day-to-day work. Appoints the council''s admins, who add and edit its groups and edit members.',
       updated_at = NOW()
 WHERE key = 'council_leader';

UPDATE ccg_roles
   SET description = 'Helps run one CCG with its Overseer: adds and edits its CCFs, and edits, transfers and removes their members.',
       updated_at = NOW()
 WHERE key = 'ccg_group_admin';

COMMIT;
