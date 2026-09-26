-- Migration 036: profile questions follow the CCF Profile Registration form
--
-- The church updated its Google Form (https://forms.gle/oMQgYwPKg4ev8REx6).
-- This rewrites the question bank to match it:
--   * Occupation & professional life: employment status (new options), job
--     title (new, free text), industry (replaces the occupation categories;
--     drives the "Line of work" factor). The form asks job title and industry
--     only of people who answer "Employed", so both are optional here.
--   * Interests: form wording; "Other sports" dropped
--   * Social profile: seven agree/disagree statements, asked of everyone
--   * Friendship preferences: asked of members too, up to 5, plus Other
-- Meeting availability (converts only) is not on the form and is kept.
--
-- Questions are updated in place (ids kept); options of the questions that
-- change meaning are replaced. At the time of writing no answers exist in
-- production, but answers to removed options are cleared anyway so nothing
-- is left pointing at a missing option.

BEGIN;

-- ---------------------------------------------------------------------------
-- Occupation & professional life
-- ---------------------------------------------------------------------------
UPDATE ccg_questions SET
  prompt = 'Are you currently:', help = NULL, section = 'Occupation & professional life',
  required = TRUE, audience = 'both', sort_order = 10, updated_at = NOW()
WHERE key = 'employment_status';

UPDATE ccg_questions SET
  key = 'industry', prompt = 'Which industry do you currently work or operate in?', help = NULL,
  section = 'Occupation & professional life', type = 'single', max_choices = NULL,
  required = FALSE, audience = 'both', factor = 'profession', method = 'same_answer', sort_order = 12, updated_at = NOW()
WHERE key = 'occupation';

INSERT INTO ccg_questions (key, prompt, help, section, type, max_choices, audience, required, factor, method, weight, sort_order) VALUES
  ('job_title', 'What''s your profession or job title?', 'For example: accountant, nurse, software developer, doctor, lawyer',
   'Occupation & professional life', 'text', NULL, 'both', FALSE, 'none', 'none', 1, 11)
ON CONFLICT (key) DO NOTHING;

DELETE FROM ccg_answers a USING ccg_questions q
 WHERE a.question_id = q.id AND q.key IN ('employment_status', 'industry');
DELETE FROM ccg_question_options o USING ccg_questions q
 WHERE o.question_id = q.id AND q.key IN ('employment_status', 'industry');

INSERT INTO ccg_question_options (question_id, key, label, catch_all, sort_order)
SELECT q.id, o.key, o.label, o.catch_all, o.ord
FROM ccg_questions q
JOIN (VALUES
  ('employment_status', 'employed', 'Employed', FALSE, 1),
  ('employment_status', 'self_employed', 'Self-employed / business owner', FALSE, 2),
  ('employment_status', 'freelancer', 'Freelancer / consultant', FALSE, 3),
  ('employment_status', 'student', 'Student', FALSE, 4),
  ('employment_status', 'internship', 'Internship / national service', FALSE, 5),
  ('employment_status', 'unemployed', 'Unemployed', FALSE, 6),
  ('employment_status', 'retired', 'Retired', FALSE, 7),
  ('employment_status', 'other', 'Other', TRUE, 8),
  ('industry', 'financial_services', 'Financial services', FALSE, 1),
  ('industry', 'energy', 'Oil & gas / energy', FALSE, 2),
  ('industry', 'technology', 'Technology', FALSE, 3),
  ('industry', 'telecoms', 'Telecommunications', FALSE, 4),
  ('industry', 'education', 'Education', FALSE, 5),
  ('industry', 'healthcare', 'Healthcare', FALSE, 6),
  ('industry', 'construction', 'Construction', FALSE, 7),
  ('industry', 'real_estate', 'Real estate', FALSE, 8),
  ('industry', 'manufacturing', 'Manufacturing', FALSE, 9),
  ('industry', 'retail', 'Retail / trading', FALSE, 10),
  ('industry', 'agriculture', 'Agriculture', FALSE, 11),
  ('industry', 'food_beverage', 'Food & beverage', FALSE, 12),
  ('industry', 'hospitality', 'Hospitality', FALSE, 13),
  ('industry', 'transport', 'Transportation / logistics', FALSE, 14),
  ('industry', 'government', 'Government', FALSE, 15),
  ('industry', 'ngo', 'NGO / development', FALSE, 16),
  ('industry', 'media', 'Media / entertainment', FALSE, 17),
  ('industry', 'professional_services', 'Professional services', FALSE, 18),
  ('industry', 'beauty_fashion', 'Beauty / fashion', FALSE, 19),
  ('industry', 'other', 'Other', TRUE, 20)
) AS o(qkey, key, label, catch_all, ord) ON o.qkey = q.key
ON CONFLICT (question_id, key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Interests
-- ---------------------------------------------------------------------------
UPDATE ccg_questions SET
  prompt = 'What are the things you genuinely enjoy?', help = 'Select up to 5.', section = 'Interests',
  max_choices = 5, required = TRUE, audience = 'both', sort_order = 20, updated_at = NOW()
WHERE key = 'interests';

-- Drop "Other sports" from any saved answer, then the option itself.
UPDATE ccg_answers a SET value = COALESCE(
    (SELECT jsonb_agg(e) FROM jsonb_array_elements(a.value) e WHERE e <> '"other_sports"'::jsonb), '[]'::jsonb)
  FROM ccg_questions q
 WHERE a.question_id = q.id AND q.key = 'interests' AND jsonb_typeof(a.value) = 'array'
   AND a.value @> '["other_sports"]'::jsonb;
DELETE FROM ccg_question_options o USING ccg_questions q
 WHERE o.question_id = q.id AND q.key = 'interests' AND o.key = 'other_sports';
UPDATE ccg_question_options o SET label = 'Cars / automobiles'
  FROM ccg_questions q WHERE o.question_id = q.id AND q.key = 'interests' AND o.key = 'cars';

-- ---------------------------------------------------------------------------
-- Social profile: seven statements, 1 = strongly disagree … 5 = strongly agree
-- ---------------------------------------------------------------------------
UPDATE ccg_questions SET key = 'trait_one_on_one' WHERE key = 'trait_deep_conversation';
UPDATE ccg_questions SET key = 'trait_checks_on_friends' WHERE key = 'trait_friendship_initiative';

INSERT INTO ccg_questions (key, prompt, section, type, audience, required, factor, method, weight, sort_order) VALUES
  ('trait_friends_outside_church', 'I enjoy spending time with friends outside church.', 'Social profile', 'scale5', 'both', TRUE, 'social', 'distance', 1, 31)
ON CONFLICT (key) DO NOTHING;

UPDATE ccg_questions q SET
  prompt = v.prompt, help = '1 = Strongly disagree, 5 = Strongly agree', section = 'Social profile',
  required = TRUE, audience = 'both', factor = 'social', method = 'distance', sort_order = v.ord, updated_at = NOW()
FROM (VALUES
  ('trait_new_people', 'I enjoy meeting new people.', 30),
  ('trait_friends_outside_church', 'I enjoy spending time with friends outside church.', 31),
  ('trait_group_activity', 'I enjoy group activities.', 32),
  ('trait_one_on_one', 'I enjoy one-on-one conversations.', 33),
  ('trait_conversation', 'I am comfortable starting conversations with people I don''t know.', 34),
  ('trait_hosting', 'I enjoy hosting or organising activities with friends.', 35),
  ('trait_checks_on_friends', 'I naturally check on friends when I haven''t heard from them.', 36)
) AS v(key, prompt, ord)
WHERE q.key = v.key;

-- ---------------------------------------------------------------------------
-- Friendship preferences
-- ---------------------------------------------------------------------------
UPDATE ccg_questions SET
  prompt = 'What kind of people do you naturally connect with?', help = 'Select up to 5.',
  section = 'Friendship preferences', max_choices = 5, required = TRUE, audience = 'both', sort_order = 40, updated_at = NOW()
WHERE key = 'friendship_prefs';

UPDATE ccg_question_options o SET label = v.label, signal = v.signal::jsonb
FROM ccg_questions q, (VALUES
  ('same_work', 'People in my profession', '{"type":"same_answer","question":"industry"}'),
  ('sports', 'People who enjoy sports', '{"type":"option_share","refs":["interests:football","interests:gym_fitness","activities:sports","activities:fitness","activities:outdoors"]}'),
  ('deep_talk', 'People who enjoy deep conversations', '{"type":"trait","questions":["trait_one_on_one"],"direction":"high"}'),
  ('calm', 'Calm / easy-going people', '{"type":"trait","questions":["trait_group_activity"],"direction":"low"}'),
  ('outgoing', 'Energetic / outgoing people', '{"type":"trait","questions":["trait_new_people","trait_group_activity"],"direction":"high"}'),
  ('anyone', 'I''m comfortable connecting with different types of people', '{"type":"neutral"}')
) AS v(key, label, signal)
WHERE o.question_id = q.id AND q.key = 'friendship_prefs' AND o.key = v.key;

INSERT INTO ccg_question_options (question_id, key, label, catch_all, sort_order)
SELECT id, 'other', 'Other', TRUE, 14 FROM ccg_questions WHERE key = 'friendship_prefs'
ON CONFLICT (question_id, key) DO NOTHING;

UPDATE ccg_questions SET
  prompt = 'What activities would you enjoy doing with your CCF?', help = 'Select up to 5.',
  section = 'Friendship preferences', max_choices = 5, required = TRUE, audience = 'both', sort_order = 41, updated_at = NOW()
WHERE key = 'activities';

-- ---------------------------------------------------------------------------
-- Meeting availability (converts only; not on the form)
-- ---------------------------------------------------------------------------
UPDATE ccg_questions SET sort_order = 50, updated_at = NOW() WHERE key = 'availability';

COMMIT;
