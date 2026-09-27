-- Migration 042: the Wednesday fellowship service, and availability out of matching
--
-- CCG Manual, weekly schedule of a CCG: Sunday service; Wednesday intercession
-- 5:00–5:30am and fellowship service 7:00–8:00pm. Fellowship meets online every
-- week and in person once a month, so a CCF's meeting time no longer tells CCFs
-- apart: a convert's "when are you free?" answer is kept (for planning outings)
-- but no longer scored against when a CCF meets.

BEGIN;

INSERT INTO ccg_activity_types (key, name, cadence, schedule, lists_people, guidance, is_active, sort_order) VALUES
  ('fellowship_service', 'Wednesday fellowship service', 'weekly', 'Wednesday 7:00–8:00pm, online',
   FALSE,
   'Every CCG holds its fellowship service on Wednesday evening, 7:00–8:00pm, online. Once a month the fellowship meets in person instead. Mark each convert''s attendance on the Attendance page: online meetings count toward their tenth online fellowship milestone, the monthly in-person meeting toward their fifth in-person one.',
   TRUE, 2)
ON CONFLICT (key) DO NOTHING;

UPDATE ccg_activity_types SET sort_order = 3, updated_at = NOW() WHERE key = 'fellowship_meal';

UPDATE ccg_questions
   SET factor = 'none', method = 'none',
       help = 'Used to plan outings. Not part of matching: every CCF meets online on Wednesday evening.',
       updated_at = NOW()
 WHERE key = 'availability';

COMMIT;
