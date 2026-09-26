-- Migration 040: only the CCG Admin and a stream's Stream Admin edit CCF members
--
-- New permission members.edit: edit, transfer and remove existing CCF members.
-- CCF Coordinators and City Church Governors keep viewing, confirming and
-- adding members (people.manage, members.confirm) but no longer change them.
-- New role Stream Admin (stream, City Church Groups side) runs the stream's
-- CCGs and CCFs, members included.

BEGIN;

UPDATE ccg_roles
   SET permissions = array_append(permissions, 'members.edit'), updated_at = NOW()
 WHERE key = 'ccg_admin' AND NOT ('members.edit' = ANY (permissions));

INSERT INTO ccg_roles (key, name, description, scope_level, permissions, is_system, sort_order) VALUES
  ('stream_admin', 'Stream Admin',
   'Runs a stream on the City Church Groups side: every CCG and CCF in it, including editing, transferring and removing members.',
   'stream',
   ARRAY['units.edit','people.view','people.manage','members.confirm','members.edit','links.manage','placements.view',
         'attendance.mark','milestones.update','checkins.record','activities.record','reports.view'],
   TRUE, 2)
ON CONFLICT (key) DO NOTHING;

COMMIT;
