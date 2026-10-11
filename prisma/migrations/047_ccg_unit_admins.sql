-- Migration 047: every CCG, council and stream has a leader and admins (additive)
--
--   CCF      leader only        CCF Coordinator
--   CCG      leader + admins    Overseer + City Church Admins (new)
--   council  leader + admins    Council Leader (new) + Council Admins
--   stream   leader + admins    Stream Leader + Stream Admins
--
-- * Names as the church uses them: a CCG's leader is its Overseer (was "City
--   Church Governor"; key ccg_governor), so a stream's leader is its Stream
--   Leader (was "Overseer"; key overseer). Keys stay; only names change.
--
-- * New permission admins.appoint: appoint and stand down a unit's admins. Held
--   by the unit's leader and the levels above (a grant covers everything
--   beneath it), and church-wide by the Church Admin. Admins themselves don't
--   hold it.
-- * City Church Admin (ccg): the Overseer's rights in one CCG, without appointing.
-- * Council Leader (council): leads a council, as Council Admin did until now
--   (no council has had one yet); Council Admins become its admins.
-- * The church-wide "CCG Admin" is renamed "Church Admin" so it is not taken
--   for a CCG's admin. Its key stays ccg_admin.
--
-- * Sheep Seeking Liaisons are now for CCGs (ccg_seeking_liaison_ccgs): a
--   Sheep Seeker follows the converts placed in every CCF of the CCGs they are
--   liaison for. ccg_seeking_liaisons (per CCF) is left in place, unused; it
--   had no rows when this was written, and is dropped in a later migration.
--
-- Safe to run before the code that uses it deploys: nothing existing loses a
-- permission, and no assignment changes.

BEGIN;

UPDATE ccg_roles
   SET permissions = array_append(permissions, 'admins.appoint'), updated_at = NOW()
 WHERE key IN ('ccg_admin', 'campus_leader', 'overseer', 'ccg_governor')
   AND NOT ('admins.appoint' = ANY (permissions));

UPDATE ccg_roles
   SET name = 'Church Admin', updated_at = NOW()
 WHERE key = 'ccg_admin' AND name = 'CCG Admin';

INSERT INTO ccg_roles (key, name, description, scope_level, permissions, is_system, sort_order) VALUES
  ('council_leader', 'Council Leader',
   'Leads a council on the City Church Groups side: every CCG and CCF in it, including editing, transferring and removing members. Appoints the council''s admins.',
   'council',
   ARRAY['units.edit','people.view','people.manage','members.confirm','members.edit','links.manage','placements.view',
         'attendance.mark','milestones.update','checkins.record','activities.record','reports.view','admins.appoint'],
   TRUE, 3),
  ('ccg_group_admin', 'City Church Admin',
   'Helps run one CCG with its Overseer: the same rights in the CCG and its CCFs, without appointing its admins.',
   'ccg',
   ARRAY['members.confirm','placements.view','people.view','attendance.mark','reports.view','people.manage','units.edit',
         'links.manage','activities.record','checkins.record','milestones.update'],
   TRUE, 3)
ON CONFLICT (key) DO NOTHING;

UPDATE ccg_roles
   SET description = 'Helps run a council with its Council Leader: every CCG and CCF in it, including editing, transferring and removing members.',
       updated_at = NOW()
 WHERE key = 'council_admin';

UPDATE ccg_roles
   SET description = 'Helps run a stream with its Stream Leader on the City Church Groups side: every CCG and CCF in it, including editing, transferring and removing members.',
       updated_at = NOW()
 WHERE key = 'stream_admin';

CREATE TABLE IF NOT EXISTS ccg_seeking_liaison_ccgs (
  ccg_id       UUID NOT NULL REFERENCES ccg_groups(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (ccg_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ccg_seeking_liaison_ccgs_user ON ccg_seeking_liaison_ccgs(user_id);

UPDATE ccg_roles
   SET description = 'Registers converts into a stream and handles their mapping into CCFs; marks attendance and follows up milestones. As a liaison, follows the converts placed in the CCGs assigned to them.',
       updated_at = NOW()
 WHERE key = 'sheep_seeker';

-- The stream's leader gives up the name first.
UPDATE ccg_roles SET name = 'Stream Leader', updated_at = NOW() WHERE key = 'overseer' AND name = 'Overseer';
UPDATE ccg_roles SET name = 'Overseer', updated_at = NOW() WHERE key = 'ccg_governor' AND name = 'City Church Governor';

COMMIT;
