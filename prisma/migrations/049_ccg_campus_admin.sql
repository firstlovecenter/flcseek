-- Migration 049: a campus has admins too; leaders are changed from the unit page (additive)
--
--   campus   leader + admins    Campus Leader + Campus Admins (new)
--
-- * Campus Admin (campus): runs every stream of the campus on the City Church
--   Groups side, as a Stream Admin runs one stream. The Campus Leader stays
--   view only. Like every admin, a Campus Admin does not appoint admins: the
--   Campus Leader (admins.appoint since 047) and the central team do.
--   Campus Admin is a City Church Groups role: it reaches no Sheep Seeking side.
--
-- * New permission leaders.appoint: change the leader of a unit beneath one's
--   own (a grant covers everything beneath it; the route checks it on the
--   unit's parent, so nobody changes their own unit's leader). Held by the
--   leaders and admins of campuses, streams, councils and CCGs, and church-wide
--   by the Church Admin. A Campus Leader's own changes stay with the central team.
--
-- Safe to run before the code that uses it deploys: one new role row and one
-- new permission, nothing existing loses anything.

BEGIN;

INSERT INTO ccg_roles (key, name, description, scope_level, permissions, is_system, sort_order) VALUES
  ('campus_admin', 'Campus Admin',
   'Helps run a campus with its Campus Leader on the City Church Groups side: every stream, council, CCG and CCF in it, including editing, transferring and removing members.',
   'campus',
   ARRAY['units.edit','people.view','people.manage','members.confirm','members.edit','links.manage','placements.view',
         'attendance.mark','milestones.update','checkins.record','activities.record','reports.view'],
   TRUE, 2)
ON CONFLICT (key) DO NOTHING;

UPDATE ccg_roles
   SET permissions = array_append(permissions, 'leaders.appoint'), updated_at = NOW()
 WHERE key IN ('ccg_admin', 'campus_leader', 'campus_admin', 'overseer', 'stream_admin',
               'council_leader', 'council_admin', 'ccg_governor', 'ccg_group_admin')
   AND NOT ('leaders.appoint' = ANY (permissions));

COMMIT;
