-- Migration 020: City Church Group (CCG) app
--
-- A second app in this codebase that will eventually replace Seek. It shares
-- ONLY the `users` table with Seek and adds no columns to it: CCG access comes
-- from role assignments in ccg_role_assignments.
--
-- Structure:  council → CCG (City Church Group) → CCF (City Church Family)
-- People:     members belong to a CCF; converts are proposed a CCF by the
--             matching engine and placed once a CCG admin approves.
-- Profiles:   answers to a configurable question bank; group profiles are
--             derived from members' answers.
--
-- Seeds: roles, a starter question bank (editable) and an empty settings row
-- (milestones come from the CCG Manual in 022). No zones, groups or people are seeded.
--
-- Apply per site:  psql $NEON_DATABASE_URL -f prisma/migrations/020_ccg_app.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- Pre-020 behaviour: a NULL users.role used to mean 'leader' in Seek. From
-- now on NULL means "no Seek access" (e.g. CCG-only users), so preserve the
-- old meaning for existing rows.
-- ---------------------------------------------------------------------------
UPDATE users SET role = 'leader' WHERE role IS NULL;

-- ---------------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ccg_settings (
  id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Zones — one vocabulary for units and people
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ccg_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(10) NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Structure: councils → CCGs → CCFs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ccg_councils (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(20) NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes       TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ccg_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  council_id  UUID REFERENCES ccg_councils(id) ON DELETE SET NULL,
  code        VARCHAR(20) NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  zone_id     UUID REFERENCES ccg_zones(id) ON DELETE SET NULL,
  -- Under-18 converts are only matched into youth CCGs, adults never are.
  audience    VARCHAR(10) NOT NULL DEFAULT 'adult' CHECK (audience IN ('adult', 'youth')),
  status      VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
  notes       TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ccg_groups_council ON ccg_groups(council_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ccg_families (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccg_id             UUID NOT NULL REFERENCES ccg_groups(id),
  code               VARCHAR(20) NOT NULL UNIQUE,
  name               VARCHAR(120) NOT NULL,
  -- NULL = same zone as the CCG
  zone_id            UUID REFERENCES ccg_zones(id) ON DELETE SET NULL,
  meeting_location   VARCHAR(200),
  meeting_day        VARCHAR(10)
                     CHECK (meeting_day IS NULL OR meeting_day IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  meeting_time       VARCHAR(5), -- 24h 'HH:MM'
  meeting_frequency  VARCHAR(20) NOT NULL DEFAULT 'Weekly',
  capacity           INTEGER NOT NULL DEFAULT 12 CHECK (capacity > 0),
  status             VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
  notes              TEXT,
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ccg_families_ccg ON ccg_families(ccg_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Roles and assignments. A role is a named set of permissions at a level;
-- an assignment gives a user that role over one unit (or globally).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ccg_roles (
  key          VARCHAR(40) PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  scope_level  VARCHAR(10) NOT NULL CHECK (scope_level IN ('global', 'council', 'ccg', 'ccf')),
  permissions  TEXT[] NOT NULL DEFAULT '{}',
  is_system    BOOLEAN NOT NULL DEFAULT FALSE,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ccg_role_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_key     VARCHAR(40) NOT NULL REFERENCES ccg_roles(key) ON UPDATE CASCADE,
  council_id   UUID REFERENCES ccg_councils(id) ON DELETE CASCADE,
  ccg_id       UUID REFERENCES ccg_groups(id) ON DELETE CASCADE,
  ccf_id       UUID REFERENCES ccg_families(id) ON DELETE CASCADE,
  starts_on    DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_on      DATE,
  assigned_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ccg_role_assignments_one_unit CHECK (num_nonnulls(council_id, ccg_id, ccf_id) <= 1),
  CONSTRAINT ccg_role_assignments_dates CHECK (ends_on IS NULL OR ends_on >= starts_on)
);
-- One open assignment per user + role + unit.
CREATE UNIQUE INDEX IF NOT EXISTS ccg_role_assignments_open_unique
  ON ccg_role_assignments (user_id, role_key, COALESCE(council_id, ccg_id, ccf_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE ends_on IS NULL;
CREATE INDEX IF NOT EXISTS idx_ccg_role_assignments_user ON ccg_role_assignments(user_id);

-- ---------------------------------------------------------------------------
-- People: members (in a CCF) and converts. Profile answers live in ccg_answers.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ccg_people (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                           VARCHAR(10) NOT NULL CHECK (kind IN ('member', 'convert')),
  ref_code                       VARCHAR(20) UNIQUE,
  full_name                      VARCHAR(150) NOT NULL,
  phone                          VARCHAR(20),
  gender                         VARCHAR(10) CHECK (gender IS NULL OR gender IN ('Male', 'Female')),
  date_of_birth                  DATE,
  zone_id                        UUID REFERENCES ccg_zones(id) ON DELETE SET NULL,
  landmark                       VARCHAR(150),
  conversion_date                DATE,
  ccf_id                         UUID REFERENCES ccg_families(id) ON DELETE SET NULL,
  existing_connection_member_id  UUID REFERENCES ccg_people(id) ON DELETE SET NULL,
  existing_connection_note       VARCHAR(300),
  possible_duplicate_of_id       UUID REFERENCES ccg_people(id) ON DELETE SET NULL,
  -- member:  pending | active | inactive
  -- convert: new | proposed | needs_info | placed | integrated | inactive
  status                         VARCHAR(20) NOT NULL,
  source                         VARCHAR(10) NOT NULL DEFAULT 'staff' CHECK (source IN ('staff', 'self')),
  notes                          TEXT,
  created_by                     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at                     TIMESTAMPTZ DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ DEFAULT NOW(),
  deleted_at                     TIMESTAMPTZ,
  CONSTRAINT ccg_people_status CHECK (
    (kind = 'member'  AND status IN ('pending', 'active', 'inactive')) OR
    (kind = 'convert' AND status IN ('new', 'proposed', 'needs_info', 'placed', 'integrated', 'inactive'))
  ),
  CONSTRAINT ccg_people_member_ccf CHECK (kind = 'member' OR ccf_id IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_ccg_people_kind ON ccg_people(kind, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ccg_people_ccf ON ccg_people(ccf_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ccg_people_phone ON ccg_people(phone) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Question bank and answers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ccg_questions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key          VARCHAR(60) NOT NULL UNIQUE,
  prompt       VARCHAR(300) NOT NULL,
  help         VARCHAR(500),
  section      VARCHAR(60),
  type         VARCHAR(10) NOT NULL CHECK (type IN ('single', 'multi', 'scale5', 'text')),
  max_choices  INTEGER CHECK (max_choices IS NULL OR max_choices > 0),
  audience     VARCHAR(10) NOT NULL DEFAULT 'both' CHECK (audience IN ('member', 'convert', 'both')),
  required     BOOLEAN NOT NULL DEFAULT FALSE,
  factor       VARCHAR(20) NOT NULL DEFAULT 'none'
               CHECK (factor IN ('interests', 'friendship', 'social', 'availability', 'profession', 'none')),
  method       VARCHAR(20) NOT NULL DEFAULT 'none'
               CHECK (method IN ('share', 'same_answer', 'distance', 'meeting_slot', 'preference', 'none')),
  weight       NUMERIC(6,3) NOT NULL DEFAULT 1 CHECK (weight >= 0),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ccg_questions_scoring CHECK (
    (factor = 'none' AND method = 'none') OR
    (factor <> 'none' AND method <> 'none' AND type <> 'text')
  )
);

CREATE TABLE IF NOT EXISTS ccg_question_options (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  UUID NOT NULL REFERENCES ccg_questions(id) ON DELETE CASCADE,
  key          VARCHAR(60) NOT NULL,
  label        VARCHAR(150) NOT NULL,
  -- Catch-all answers ('Other') carry no signal and never count as shared.
  catch_all    BOOLEAN NOT NULL DEFAULT FALSE,
  -- Preference options only: what the group must show to satisfy it.
  signal       JSONB,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT ccg_question_options_key UNIQUE (question_id, key)
);

CREATE TABLE IF NOT EXISTS ccg_answers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id    UUID NOT NULL REFERENCES ccg_people(id) ON DELETE CASCADE,
  question_id  UUID NOT NULL REFERENCES ccg_questions(id) ON DELETE CASCADE,
  -- single: "key"   multi: ["key", …]   scale5: 1..5   text: "…"
  value        JSONB NOT NULL,
  source       VARCHAR(10) NOT NULL DEFAULT 'staff' CHECK (source IN ('staff', 'self')),
  updated_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ccg_answers_person_question UNIQUE (person_id, question_id)
);

-- ---------------------------------------------------------------------------
-- Self-service form links and their submissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ccg_form_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        VARCHAR(20) NOT NULL CHECK (kind IN ('member_ccf', 'convert_intake', 'person_update')),
  ccf_id      UUID REFERENCES ccg_families(id) ON DELETE CASCADE,
  person_id   UUID REFERENCES ccg_people(id) ON DELETE CASCADE,
  label       VARCHAR(150),
  -- SHA-256 of the token; the token itself is shown once and never stored.
  token_hash  CHAR(64) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ,
  max_uses    INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  uses        INTEGER NOT NULL DEFAULT 0,
  revoked_at  TIMESTAMPTZ,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ccg_form_links_target CHECK (
    (kind = 'member_ccf'     AND ccf_id IS NOT NULL AND person_id IS NULL) OR
    (kind = 'convert_intake' AND ccf_id IS NULL     AND person_id IS NULL) OR
    (kind = 'person_update'  AND person_id IS NOT NULL AND ccf_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS ccg_submissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id               UUID NOT NULL REFERENCES ccg_form_links(id) ON DELETE CASCADE,
  client_submission_id  UUID NOT NULL UNIQUE,
  person_id             UUID REFERENCES ccg_people(id) ON DELETE SET NULL,
  ip_hash               CHAR(64),
  user_agent            VARCHAR(300),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Matching and placement
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ccg_match_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id        UUID NOT NULL REFERENCES ccg_people(id) ON DELETE CASCADE,
  trigger          VARCHAR(20) NOT NULL CHECK (trigger IN ('registration', 'answers_changed', 'rescore', 'manual')),
  run_by           UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL = automatic
  config_snapshot  JSONB NOT NULL,
  results          JSONB NOT NULL,
  top1_ccf_id      UUID REFERENCES ccg_families(id) ON DELETE SET NULL,
  top1_score       NUMERIC(5,2),
  top2_ccf_id      UUID REFERENCES ccg_families(id) ON DELETE SET NULL,
  top2_score       NUMERIC(5,2),
  top3_ccf_id      UUID REFERENCES ccg_families(id) ON DELETE SET NULL,
  top3_score       NUMERIC(5,2),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ccg_match_runs_person ON ccg_match_runs(person_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ccg_placements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id          UUID NOT NULL REFERENCES ccg_people(id) ON DELETE CASCADE,
  match_run_id       UUID REFERENCES ccg_match_runs(id) ON DELETE SET NULL,
  -- NULL when no CCF was eligible (the placement is created 'held').
  proposed_ccf_id    UUID REFERENCES ccg_families(id) ON DELETE SET NULL,
  proposed_score     NUMERIC(5,2),
  final_ccf_id       UUID REFERENCES ccg_families(id),
  final_score        NUMERIC(5,2),
  -- proposed → active (approved/remapped) | held → proposed … ; superseded when re-proposed
  status             VARCHAR(12) NOT NULL CHECK (status IN ('proposed', 'held', 'active', 'ended', 'superseded')),
  decision           VARCHAR(10) CHECK (decision IN ('approved', 'remapped')),
  override_reason    TEXT,
  full_ccf_override  BOOLEAN NOT NULL DEFAULT FALSE,
  hold_reason        TEXT,
  decided_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at         TIMESTAMPTZ,
  ended_at           TIMESTAMPTZ,
  end_reason         TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ccg_placements_remap_reason CHECK (
    decision IS DISTINCT FROM 'remapped' OR COALESCE(TRIM(override_reason), '') <> ''
  ),
  CONSTRAINT ccg_placements_active_has_ccf CHECK (status NOT IN ('active', 'ended') OR final_ccf_id IS NOT NULL)
);
-- One open proposal and one active placement per person.
CREATE UNIQUE INDEX IF NOT EXISTS ccg_placements_one_open
  ON ccg_placements(person_id) WHERE status IN ('proposed', 'held');
CREATE UNIQUE INDEX IF NOT EXISTS ccg_placements_one_active
  ON ccg_placements(person_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ccg_placements_status ON ccg_placements(status, created_at);
CREATE INDEX IF NOT EXISTS idx_ccg_placements_final ON ccg_placements(final_ccf_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ccg_placements_proposed ON ccg_placements(proposed_ccf_id) WHERE status = 'proposed';

-- ---------------------------------------------------------------------------
-- Integration milestones, progress and check-ins
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ccg_milestones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_number  INTEGER NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  short_name    VARCHAR(30) NOT NULL,
  description   TEXT,
  target_days   INTEGER CHECK (target_days IS NULL OR target_days >= 0), -- after approval
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ccg_progress_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id    UUID NOT NULL REFERENCES ccg_placements(id) ON DELETE CASCADE,
  stage_number    INTEGER NOT NULL,
  is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  date_completed  DATE,
  notes           TEXT,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ccg_progress_placement_stage UNIQUE (placement_id, stage_number)
);

CREATE TABLE IF NOT EXISTS ccg_check_ins (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id        UUID NOT NULL REFERENCES ccg_placements(id) ON DELETE CASCADE,
  convert_rating      SMALLINT CHECK (convert_rating BETWEEN 1 AND 5),
  group_rating        SMALLINT CHECK (group_rating BETWEEN 1 AND 5),
  follow_up_required  BOOLEAN NOT NULL DEFAULT FALSE,
  notes               TEXT,
  recorded_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ccg_check_ins_placement ON ccg_check_ins(placement_id, recorded_at DESC);

-- ---------------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ccg_activity_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action       VARCHAR(60) NOT NULL,
  entity_type  VARCHAR(40),
  entity_id    UUID,
  old_values   JSONB,
  new_values   JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ccg_activity_entity ON ccg_activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ccg_activity_created ON ccg_activity_log(created_at DESC);

-- ===========================================================================
-- Seeds
-- ===========================================================================
INSERT INTO ccg_settings (id, config) VALUES (1, '{}'::jsonb) ON CONFLICT (id) DO NOTHING;

-- Roles. Permissions are defined in code (src/lib/ccg/permissions.ts); a role
-- is a named bundle of them. More roles can be added as rows.
INSERT INTO ccg_roles (key, name, description, scope_level, permissions, is_system, sort_order) VALUES
  ('ccg_admin', 'CCG Admin', 'Sets up the structure and questions, manages roles, and approves placements.', 'global',
    ARRAY['structure.manage','units.edit','people.view','people.manage','members.confirm','links.manage','links.intake',
          'placements.view','placements.approve','milestones.update','checkins.record','reports.view',
          'settings.manage','roles.manage'], TRUE, 1),
  ('overseer', 'Overseer', 'Oversees a council of CCGs.', 'council',
    ARRAY['people.view','placements.view','milestones.update','checkins.record','reports.view'], TRUE, 2),
  ('ccg_governor', 'City Church Governor', 'Leads a CCG and every CCF in it.', 'ccg',
    ARRAY['units.edit','people.view','people.manage','members.confirm','links.manage',
          'placements.view','milestones.update','checkins.record','reports.view'], TRUE, 3),
  ('ccf_coordinator', 'City Church Family Coordinator', 'Leads a CCF.', 'ccf',
    ARRAY['people.view','people.manage','members.confirm','links.manage',
          'placements.view','milestones.update','checkins.record','reports.view'], TRUE, 4)
ON CONFLICT (key) DO NOTHING;

-- Starter question bank (editable). Structure follows the prototype's logic;
-- options are starting points, not data.
INSERT INTO ccg_questions (key, prompt, help, section, type, max_choices, audience, required, factor, method, weight, sort_order) VALUES
  ('interests', 'What are you interested in?', 'Pick up to 5.', 'Interests', 'multi', 5, 'both', TRUE, 'interests', 'share', 1, 10),
  ('activities', 'What do you enjoy doing with others?', 'Pick up to 5.', 'Interests', 'multi', 5, 'both', FALSE, 'interests', 'share', 0.5, 20),
  ('friendship_prefs', 'What kind of friends are you hoping to find?', 'Pick up to 4.', 'Friendship', 'multi', 4, 'convert', FALSE, 'friendship', 'preference', 1, 30),
  ('availability', 'When are you usually free?', 'Pick all that apply.', 'Availability', 'multi', 8, 'convert', TRUE, 'availability', 'meeting_slot', 1, 40),
  ('trait_new_people', 'How comfortable are you meeting new people?', '1 = not at all, 5 = very', 'Social style', 'scale5', NULL, 'both', FALSE, 'social', 'distance', 1, 50),
  ('trait_group_activity', 'How much do you enjoy group activities?', '1 = prefer one-to-one, 5 = love groups', 'Social style', 'scale5', NULL, 'both', FALSE, 'social', 'distance', 1, 51),
  ('trait_conversation', 'How easily do you start conversations?', '1 = rarely, 5 = easily', 'Social style', 'scale5', NULL, 'both', FALSE, 'social', 'distance', 1, 52),
  ('trait_deep_conversation', 'How much do you enjoy deep conversations?', '1 = rarely, 5 = often', 'Social style', 'scale5', NULL, 'both', FALSE, 'social', 'distance', 1, 53),
  ('trait_hosting', 'How often do you host or welcome new people?', '1 = rarely, 5 = often', 'Social style', 'scale5', NULL, 'member', FALSE, 'none', 'none', 1, 54),
  ('trait_friendship_initiative', 'How often do you take the first step in a friendship?', '1 = rarely, 5 = often', 'Social style', 'scale5', NULL, 'member', FALSE, 'none', 'none', 1, 55),
  ('occupation', 'What kind of work do you do?', NULL, 'Work', 'single', NULL, 'both', FALSE, 'profession', 'same_answer', 1, 60),
  ('employment_status', 'What is your employment status?', NULL, 'Work', 'single', NULL, 'both', FALSE, 'none', 'none', 1, 61)
ON CONFLICT (key) DO NOTHING;

INSERT INTO ccg_question_options (question_id, key, label, catch_all, sort_order)
SELECT q.id, o.key, o.label, o.catch_all, o.ord
FROM ccg_questions q
JOIN (VALUES
  ('interests', 'football', 'Football', FALSE, 1),
  ('interests', 'other_sports', 'Other sports', FALSE, 2),
  ('interests', 'gym_fitness', 'Gym / fitness', FALSE, 3),
  ('interests', 'music', 'Music', FALSE, 4),
  ('interests', 'movies', 'Movies', FALSE, 5),
  ('interests', 'food', 'Food', FALSE, 6),
  ('interests', 'travel', 'Travel', FALSE, 7),
  ('interests', 'fashion', 'Fashion', FALSE, 8),
  ('interests', 'business', 'Business', FALSE, 9),
  ('interests', 'entrepreneurship', 'Entrepreneurship', FALSE, 10),
  ('interests', 'technology', 'Technology', FALSE, 11),
  ('interests', 'finance', 'Finance / investing', FALSE, 12),
  ('interests', 'reading', 'Reading', FALSE, 13),
  ('interests', 'gaming', 'Gaming', FALSE, 14),
  ('interests', 'photography', 'Photography', FALSE, 15),
  ('interests', 'arts', 'Arts', FALSE, 16),
  ('interests', 'volunteering', 'Volunteering', FALSE, 17),
  ('interests', 'cooking', 'Cooking', FALSE, 18),
  ('interests', 'cars', 'Cars', FALSE, 19),
  ('interests', 'other', 'Other', TRUE, 20),
  ('activities', 'eating_together', 'Eating together', FALSE, 1),
  ('activities', 'sports', 'Football / sports', FALSE, 2),
  ('activities', 'games', 'Games', FALSE, 3),
  ('activities', 'movies', 'Movies', FALSE, 4),
  ('activities', 'fitness', 'Gym / fitness', FALSE, 5),
  ('activities', 'business_talk', 'Business discussions', FALSE, 6),
  ('activities', 'study', 'Study sessions', FALSE, 7),
  ('activities', 'visiting', 'Visiting one another', FALSE, 8),
  ('activities', 'outdoors', 'Outdoor activities', FALSE, 9),
  ('activities', 'volunteering', 'Volunteering', FALSE, 10),
  ('activities', 'celebrations', 'Birthday celebrations', FALSE, 11),
  ('activities', 'trips', 'Travel / trips', FALSE, 12),
  ('activities', 'other', 'Other', TRUE, 13),
  -- Keys match meetingSlotKey(): weekday_* / saturday_* / sunday_* × mornings | afternoons | evenings
  ('availability', 'weekday_mornings', 'Weekday mornings', FALSE, 1),
  ('availability', 'weekday_afternoons', 'Weekday afternoons', FALSE, 2),
  ('availability', 'weekday_evenings', 'Weekday evenings', FALSE, 3),
  ('availability', 'saturday_mornings', 'Saturday mornings', FALSE, 4),
  ('availability', 'saturday_afternoons', 'Saturday afternoons', FALSE, 5),
  ('availability', 'saturday_evenings', 'Saturday evenings', FALSE, 6),
  ('availability', 'sunday_afternoons', 'Sunday afternoons', FALSE, 7),
  ('availability', 'sunday_evenings', 'Sunday evenings', FALSE, 8),
  ('occupation', 'health', 'Health professional', FALSE, 1),
  ('occupation', 'corporate', 'Corporate professional', FALSE, 2),
  ('occupation', 'university_student', 'University student', FALSE, 3),
  ('occupation', 'graduate_student', 'Graduate student', FALSE, 4),
  ('occupation', 'artisan', 'Artisan / trade', FALSE, 5),
  ('occupation', 'entrepreneur', 'Entrepreneur', FALSE, 6),
  ('occupation', 'civil_servant', 'Civil servant', FALSE, 7),
  ('occupation', 'teacher', 'Teacher / educator', FALSE, 8),
  ('occupation', 'creative', 'Creative / arts professional', FALSE, 9),
  ('occupation', 'technology', 'Technology professional', FALSE, 10),
  ('occupation', 'finance', 'Finance professional', FALSE, 11),
  ('occupation', 'retiree', 'Retiree', FALSE, 12),
  ('occupation', 'job_seeker', 'Unemployed / job-seeker', FALSE, 13),
  ('occupation', 'trader', 'Trader / sales', FALSE, 14),
  ('occupation', 'driver', 'Driver / transport', FALSE, 15),
  ('occupation', 'other', 'Other', TRUE, 16),
  ('employment_status', 'full_time', 'Employed full-time', FALSE, 1),
  ('employment_status', 'part_time', 'Employed part-time', FALSE, 2),
  ('employment_status', 'self_employed', 'Self-employed', FALSE, 3),
  ('employment_status', 'student', 'Student', FALSE, 4),
  ('employment_status', 'unemployed', 'Unemployed', FALSE, 5),
  ('employment_status', 'retired', 'Retired', FALSE, 6)
) AS o(qkey, key, label, catch_all, ord) ON o.qkey = q.key
ON CONFLICT (question_id, key) DO NOTHING;

-- Friendship preferences: each option says what the group must show.
INSERT INTO ccg_question_options (question_id, key, label, signal, sort_order)
SELECT q.id, o.key, o.label, o.signal::jsonb, o.ord
FROM ccg_questions q
JOIN (VALUES
  ('age', 'People around my age', '{"type":"age"}', 1),
  ('similar_interests', 'People with similar interests', '{"type":"similar","factor":"interests"}', 2),
  ('same_work', 'People in my line of work', '{"type":"same_answer","question":"occupation"}', 3),
  ('sports', 'People who enjoy sports', '{"type":"option_share","refs":["interests:football","interests:other_sports","interests:gym_fitness","activities:sports","activities:fitness","activities:outdoors"]}', 4),
  ('business', 'People interested in business', '{"type":"option_share","refs":["interests:business","interests:entrepreneurship","interests:finance","activities:business_talk"]}', 5),
  ('technology', 'People interested in technology', '{"type":"option_share","refs":["interests:technology","interests:gaming"]}', 6),
  ('social', 'People who enjoy social activities', '{"type":"trait","questions":["trait_group_activity"],"direction":"high"}', 7),
  ('deep_talk', 'People who enjoy deep conversations', '{"type":"trait","questions":["trait_deep_conversation"],"direction":"high"}', 8),
  ('calm', 'Calm, easy-going people', '{"type":"trait","questions":["trait_group_activity"],"direction":"low"}', 9),
  ('outgoing', 'Energetic, outgoing people', '{"type":"trait","questions":["trait_new_people","trait_group_activity"],"direction":"high"}', 10),
  ('learning', 'People who enjoy learning', '{"type":"option_share","refs":["interests:reading","activities:study"]}', 11),
  ('helping', 'People who enjoy helping others', '{"type":"option_share","refs":["interests:volunteering","activities:volunteering","activities:visiting"]}', 12),
  ('anyone', 'I''m comfortable with all kinds of people', '{"type":"neutral"}', 13)
) AS o(key, label, signal, ord) ON q.key = 'friendship_prefs'
ON CONFLICT (question_id, key) DO NOTHING;

-- Milestones are seeded from the CCG Manual in 022.

COMMIT;
