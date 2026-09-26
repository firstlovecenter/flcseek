-- Migration 039: Sheep Seeking admins and overseers, per stream and per campus
--
--   Stream Sheep Seeking Admin     (stream)  acts: registers converts, approves placements,
--                                            appoints Sheep Seekers, runs seeking groups
--   Stream Sheep Seeking Overseer  (stream)  view only
--   Campus Sheep Seeking Admin     (campus)  acts, across the campus's streams
--   Campus Sheep Seeking Overseer  (campus)  view only, across the campus's streams
--   Sheep Seeker                   (stream)  unchanged
--
-- The old Sheep Seeking Overseer acted; anyone holding it becomes the stream's
-- Sheep Seeking Admin, so nobody loses what they could do.

BEGIN;

INSERT INTO ccg_roles (key, name, description, scope_level, permissions, is_system, sort_order) VALUES
  ('seeking_admin', 'Stream Sheep Seeking Admin',
   'Runs Sheep Seeking for a stream: registers converts, approves their placements, appoints Sheep Seekers and runs seeking groups, and follows converts'' progress.',
   'stream',
   ARRAY['people.view','people.manage','links.intake','placements.view','placements.approve','attendance.mark','milestones.update','checkins.record','reports.view','seekers.manage'],
   TRUE, 5),
  ('campus_seeking_admin', 'Campus Sheep Seeking Admin',
   'Runs Sheep Seeking across every stream in a campus: registers converts, approves placements, appoints Sheep Seekers and each stream''s Sheep Seeking Admin and Overseer, and follows converts'' progress.',
   'campus',
   ARRAY['people.view','people.manage','links.intake','placements.view','placements.approve','attendance.mark','milestones.update','checkins.record','reports.view','seekers.manage'],
   TRUE, 5),
  ('campus_seeking_overseer', 'Campus Sheep Seeking Overseer',
   'Sees Sheep Seeking across every stream in a campus: converts, placements, progress and reports. View only.',
   'campus',
   ARRAY['people.view','placements.view','reports.view'],
   TRUE, 6)
ON CONFLICT (key) DO NOTHING;

UPDATE ccg_role_assignments SET role_key = 'seeking_admin' WHERE role_key = 'seeking_overseer';

UPDATE ccg_roles
   SET name = 'Stream Sheep Seeking Overseer',
       description = 'Sees Sheep Seeking for a stream: converts, placements, progress and reports. View only.',
       permissions = ARRAY['people.view','placements.view','reports.view'],
       sort_order = 6,
       updated_at = NOW()
 WHERE key = 'seeking_overseer';

UPDATE ccg_roles SET sort_order = 7, updated_at = NOW() WHERE key = 'sheep_seeker';

COMMIT;
