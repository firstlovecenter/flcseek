-- Migration 041: follow the New Convert CCF Registration form
--
-- The church's new-convert Google Form differs from the CCF profile form that
-- migration 036 followed:
--   * Location and landmark are separate questions → new ccg_people.location
--     (landmark keeps "near what")
--   * "Does the new convert attend Bacenta Midweek Meeting?" (converts only)
--   * "What type of student is the new convert?" (asked of students)
--   * Interests are no longer asked, the social-profile statements are
--     optional, and availability is not on the form → not required
--   * Kinds of people and CCF activities have no limit on choices
-- Question ids are kept; nothing is deleted.

BEGIN;

ALTER TABLE ccg_people ADD COLUMN IF NOT EXISTS location VARCHAR(150);

INSERT INTO ccg_questions (key, prompt, help, section, type, max_choices, audience, required, factor, method, weight, sort_order) VALUES
  ('attends_bacenta', 'Do you attend the Bacenta midweek meeting?', NULL,
   'Church life', 'single', NULL, 'convert', FALSE, 'none', 'none', 1, 5),
  ('student_type', 'What type of student are you?', 'Students only',
   'Occupation & professional life', 'single', NULL, 'both', FALSE, 'none', 'none', 1, 13)
ON CONFLICT (key) DO NOTHING;

INSERT INTO ccg_question_options (question_id, key, label, catch_all, sort_order)
SELECT q.id, o.key, o.label, FALSE, o.ord
FROM ccg_questions q
JOIN (VALUES
  ('attends_bacenta', 'yes', 'Yes', 1),
  ('attends_bacenta', 'no', 'No', 2),
  ('student_type', 'shs', 'Senior High School (SHS)', 1),
  ('student_type', 'technical', 'Technical / vocational', 2),
  ('student_type', 'undergraduate', 'Undergraduate', 3),
  ('student_type', 'masters', 'Postgraduate – master''s', 4),
  ('student_type', 'phd', 'Postgraduate – PhD', 5),
  ('student_type', 'professional', 'Professional / certification', 6)
) AS o(qkey, key, label, ord) ON o.qkey = q.key
ON CONFLICT (question_id, key) DO NOTHING;

UPDATE ccg_questions SET required = FALSE, updated_at = NOW()
WHERE key IN ('interests', 'availability')
   OR key LIKE 'trait\_%';

UPDATE ccg_questions SET max_choices = NULL, help = NULL, updated_at = NOW()
WHERE key IN ('friendship_prefs', 'activities');

COMMIT;
