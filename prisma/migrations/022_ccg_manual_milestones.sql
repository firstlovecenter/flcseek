-- Migration 022: CCG retention milestones from the CCG Manual (v2.3)
--
-- Milestones stay DB-backed and editable, as in Seek. Each has a kind:
--   manual     ticked by a leader, with a date (baptisms, visitations)
--   attendance completes itself when the convert's marked attendance at one
--              event type reaches a target (10 Sundays, 10 online, 5 in person)
--   checklist  completes itself when every active item is ticked
--              (Seeing and Hearing, introduction to the Overseer)
-- Auto-completed milestones are written to ccg_progress_records (source 'auto'),
-- like Seek's milestone-auto-calc, so every reader sees one source of truth.
--
-- The manual's CCG-level duties (Wednesday intercession, the quarterly outing
-- over food) are logged per CCG, not per convert.
--
-- Also adds the Sheep Seeker role (convert registration and mapping, per stream) and the attendance.mark / activities.record
-- permissions.
--
-- Apply after 021:  npx tsx scripts/ccg-apply-migration.ts prisma/migrations/022_ccg_manual_milestones.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- Milestone kinds, guidance and checklist items
-- ---------------------------------------------------------------------------
ALTER TABLE ccg_milestones ADD COLUMN IF NOT EXISTS kind VARCHAR(12) NOT NULL DEFAULT 'manual';
ALTER TABLE ccg_milestones ADD COLUMN IF NOT EXISTS attendance_event VARCHAR(30);
ALTER TABLE ccg_milestones ADD COLUMN IF NOT EXISTS attendance_target INTEGER;
ALTER TABLE ccg_milestones ADD COLUMN IF NOT EXISTS guidance TEXT;

ALTER TABLE ccg_milestones DROP CONSTRAINT IF EXISTS ccg_milestones_kind_check;
ALTER TABLE ccg_milestones ADD CONSTRAINT ccg_milestones_kind_check CHECK (
  kind IN ('manual', 'attendance', 'checklist')
  AND (attendance_event IS NULL OR attendance_event IN ('sunday_service', 'online_fellowship', 'in_person_fellowship'))
  AND (attendance_target IS NULL OR attendance_target > 0)
  AND (kind <> 'attendance' OR (attendance_event IS NOT NULL AND attendance_target IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS ccg_milestone_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id  UUID NOT NULL REFERENCES ccg_milestones(id) ON DELETE CASCADE,
  key           VARCHAR(60) NOT NULL,
  label         VARCHAR(200) NOT NULL,
  help          TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ccg_milestone_items_key UNIQUE (milestone_id, key)
);

-- A row means the item is done for that placement.
CREATE TABLE IF NOT EXISTS ccg_progress_items (
  placement_id  UUID NOT NULL REFERENCES ccg_placements(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES ccg_milestone_items(id) ON DELETE CASCADE,
  done_on       DATE NOT NULL,
  updated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (placement_id, item_id)
);

ALTER TABLE ccg_progress_records ADD COLUMN IF NOT EXISTS source VARCHAR(6) NOT NULL DEFAULT 'manual';
ALTER TABLE ccg_progress_records DROP CONSTRAINT IF EXISTS ccg_progress_records_source_check;
ALTER TABLE ccg_progress_records ADD CONSTRAINT ccg_progress_records_source_check CHECK (source IN ('manual', 'auto'));

-- ---------------------------------------------------------------------------
-- Attendance: one row per convert per event per day. Kept per person, so a
-- convert who is remapped keeps their count.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ccg_attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id   UUID NOT NULL REFERENCES ccg_people(id) ON DELETE CASCADE,
  event_type  VARCHAR(30) NOT NULL CHECK (event_type IN ('sunday_service', 'online_fellowship', 'in_person_fellowship')),
  event_date  DATE NOT NULL,
  ccf_id      UUID REFERENCES ccg_families(id) ON DELETE SET NULL,
  marked_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ccg_attendance_once UNIQUE (person_id, event_type, event_date)
);
CREATE INDEX IF NOT EXISTS idx_ccg_attendance_ccf_date ON ccg_attendance(ccf_id, event_date);

-- ---------------------------------------------------------------------------
-- CCG activities (manual: weekly intercession, quarterly fellowship over food)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ccg_activity_types (
  key           VARCHAR(40) PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  cadence       VARCHAR(10) NOT NULL CHECK (cadence IN ('weekly', 'monthly', 'quarterly')),
  schedule      VARCHAR(120),
  lists_people  BOOLEAN NOT NULL DEFAULT FALSE,
  guidance      TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ccg_group_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccg_id          UUID NOT NULL REFERENCES ccg_groups(id) ON DELETE CASCADE,
  type_key        VARCHAR(40) NOT NULL REFERENCES ccg_activity_types(key) ON UPDATE CASCADE,
  held_on         DATE NOT NULL,
  attendee_count  INTEGER CHECK (attendee_count IS NULL OR attendee_count >= 0),
  notes           TEXT,
  recorded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ccg_group_activities_once UNIQUE (ccg_id, type_key, held_on)
);
CREATE INDEX IF NOT EXISTS idx_ccg_group_activities_ccg ON ccg_group_activities(ccg_id, held_on DESC);

-- Converts prayed for by name at an intercession (lists_people types).
CREATE TABLE IF NOT EXISTS ccg_group_activity_people (
  activity_id  UUID NOT NULL REFERENCES ccg_group_activities(id) ON DELETE CASCADE,
  person_id    UUID NOT NULL REFERENCES ccg_people(id) ON DELETE CASCADE,
  PRIMARY KEY (activity_id, person_id)
);

-- ---------------------------------------------------------------------------
-- Roles: Sheep Seeker, and the new permissions on the seeded roles
-- ---------------------------------------------------------------------------
INSERT INTO ccg_roles (key, name, description, scope_level, permissions, is_system, sort_order) VALUES
  ('sheep_seeker', 'Sheep Seeker', 'Registers converts and handles their mapping into CCFs in a stream; marks attendance and follows up milestones.', 'stream',
    ARRAY['people.view','people.manage','links.intake','placements.view','placements.approve',
          'attendance.mark','milestones.update','checkins.record','reports.view'], TRUE, 5)
ON CONFLICT (key) DO NOTHING;

UPDATE ccg_roles SET permissions = ARRAY(SELECT DISTINCT unnest(permissions || ARRAY['attendance.mark','activities.record'])), updated_at = NOW()
  WHERE key IN ('ccg_admin', 'overseer', 'ccg_governor');
UPDATE ccg_roles SET permissions = ARRAY(SELECT DISTINCT unnest(permissions || ARRAY['attendance.mark'])), updated_at = NOW()
  WHERE key = 'ccf_coordinator';

-- ---------------------------------------------------------------------------
-- Replace the starter placeholders (never real data) with the manual's milestones
-- ---------------------------------------------------------------------------
DELETE FROM ccg_progress_records WHERE stage_number IN (
  SELECT stage_number FROM ccg_milestones WHERE name IN (
    'Introduced to the CCF', 'First contact with a member', 'Attended a first CCF meeting', 'Friendship developed',
    'Active in the CCF', 'Feels they belong', 'Active in church', 'Still integrated at 12 months'));
DELETE FROM ccg_milestones WHERE name IN (
  'Introduced to the CCF', 'First contact with a member', 'Attended a first CCF meeting', 'Friendship developed',
  'Active in the CCF', 'Feels they belong', 'Active in church', 'Still integrated at 12 months');

INSERT INTO ccg_milestones (stage_number, name, short_name, kind, attendance_event, attendance_target, target_days, description, guidance) VALUES
  (1, 'Tenth Sunday', '10 Sundays', 'attendance', 'sunday_service', 10, 365,
    'Attended 10 Sunday services.',
    $g$The Fellowship Milestones (Acts 2:42). A convert who reaches the three fellowship milestones within a year has become a stable member. The CCG shepherd must mark the attendance of every convert until they reach them:
- the tenth (10) Sunday
- the tenth (10) online fellowship meeting
- the fifth (5) in-person fellowship meeting$g$),
  (2, 'Tenth online fellowship meeting', '10 online', 'attendance', 'online_fellowship', 10, 365,
    'Attended 10 online fellowship meetings.',
    $g$Part of the Fellowship Milestones: the tenth (10) online fellowship meeting, within a year. Mark attendance at every online fellowship meeting.$g$),
  (3, 'Fifth in-person fellowship meeting', '5 in person', 'attendance', 'in_person_fellowship', 5, 365,
    'Attended 5 in-person fellowship meetings.',
    $g$Part of the Fellowship Milestones: the fifth (5) in-person fellowship meeting, within a year. Mark attendance at every in-person fellowship meeting.$g$),
  (4, 'Water baptism', 'Water baptism', 'manual', NULL, NULL, 365,
    'Baptised in water.',
    $g$1. The minister and the candidates dress appropriately: no white clothes (they become see-through when wet), not bare-chested, no swimming costume, tank top or singlet. A dark t-shirt, long shorts or a tracksuit is recommended. Do not change clothes in public.
2. Open in prayer, asking for the presence of the Holy Spirit.
3. Lift a song, e.g. "I am a new creation" or "I love this family of God".
4. Read Acts 10:47-48 and Mark 16:16. Explain that water baptism is an outward show of what God has already done inside them.
5. Have two assistants in the water and at least one outside to help each person in and out.
6. Ask each candidate: Do you believe in Jesus Christ? Do you believe that He died for your sins and rose again on the third day? Do you believe that one day you will live with Him forever in heaven?
7. If yes: "I baptize you in the name of the Father, the Son and the Holy Spirit." Immerse completely, three times (the Father, the Son, the Holy Spirit).
8. Close with a song and a prayer of thanks.$g$),
  (5, 'Holy Ghost baptism', 'Holy Ghost', 'manual', NULL, NULL, 365,
    'Received the gift of speaking in tongues.',
    $g$1. Open in prayer.
2. Read Mark 16:17: speaking in tongues is a gift from the Holy Spirit for all believers.
3. Read Acts 2:4. Explain that you will lay hands on them; God will not force their mouths open. They must speak out by faith, and as they begin the Holy Spirit gives the utterance.
4. Lay hands and pray; encourage them to open their mouths and speak. Ask those around who speak in tongues to do so. Lay hands more than once as you are led.
5. Close in prayer.
6. Aim for every candidate to receive. Encourage those who did not that they will receive at another time.
7. Tell those who received to use the gift at every opportunity, every day.$g$),
  (6, 'First visitation: Come to church', '1st visit', 'manual', NULL, NULL, 365,
    'Visited and encouraged to come to church every Sunday, on time.',
    $g$Objective: encourage the new believer to come to church every Sunday and impress on them the importance of regular attendance.
General guidelines: plan visits by area; no more than 25 minutes per visit; take prayer requests from everyone in the home; dress appropriately; tell them when you will arrive and be on time; do not accept food (water is fine); do not appear rushed; wait to be welcomed and seated; preach so they understand, without notes.
What to share: Matthew 24:3-8 and 24:9-14 (the signs of His coming); Hebrews 10:25 (do not give up meeting together); how often have you been to church this month? (Psalm 122:1, 1 Thessalonians 2:18); coming late (Acts 3:1); lead them into a covenant to be in church every Sunday and on time (Psalm 63:1, Genesis 28:20-22).
Pray: over their requests; against worldliness, laziness, negative influence from friends, spirits that hinder church attendance, offence, immaturity and flirtation between churches; plead the blood over them and their family.
Discuss any hindrances to coming to church and find practical solutions.$g$),
  (7, 'Second visitation: Read your Bible and pray every day', '2nd visit', 'manual', NULL, NULL, 365,
    'Visited and taught how to have a quiet time.',
    $g$Objective: teach the new believer to have their quiet time.
Share: the quiet time builds the most important relationship of your life (Psalm 73:25); a real Christian spends time with God every morning (Psalm 5:3).
Teach it practically with their Bible and a notebook (or phone):
i. Set a regular, unchangeable time; the morning is best.
ii. Withdraw from other people.
iii. Create an atmosphere of worship (e.g. Lord I Give You My Heart, Here I Am Waiting, I Am Thirsty, Jesus Let Me Thank You, We Wanna Bask, He Will Carry Me).
iv. Pray to begin: thank God and ask Him to speak.
v. Read a portion of one book daily; start with a gospel.
vi. Meditate and write down what God is teaching you.
vii. Pray about it and ask for help to obey.
Pray with them to be faithful in seeking Him every day (Psalm 27:8).$g$),
  (8, 'Seeing and Hearing', 'Seeing & hearing', 'checklist', NULL, NULL, 365,
    'Connected to the church''s channels, apps, books and messages.',
    $g$Take the new convert through Seeing and Hearing education. Tick each item as it is set up on their phone.$g$),
  (9, 'Introduced to the CCG Overseer', 'Overseer', 'checklist', NULL, NULL, 365,
    'Fully and properly introduced to the CCG Overseer.',
    $g$A full and proper introduction to the CCG Overseer means all four of these have happened.$g$)
ON CONFLICT (stage_number) DO NOTHING;

INSERT INTO ccg_milestone_items (milestone_id, key, label, help, sort_order)
SELECT m.id, i.key, i.label, i.help, i.sort_order
FROM ccg_milestones m
JOIN (VALUES
  (8, 'youtube_app', 'YouTube app installed on their phone', NULL, 10),
  (8, 'yt_flc_official', 'Subscribed: First Love Center Official', NULL, 20),
  (8, 'yt_meeting_god', 'Subscribed: Meeting God', NULL, 21),
  (8, 'yt_dhm', 'Subscribed: Dag Heward-Mills', NULL, 22),
  (8, 'yt_dhm_loyalty', 'Subscribed: Dag Heward-Mills Loyalty and Disloyalty', NULL, 23),
  (8, 'yt_dhm_camps', 'Subscribed: Dag Heward-Mills Camps', NULL, 24),
  (8, 'yt_dhm_gtwc', 'Subscribed: Dag Heward-Mills Conference (GTWC)', NULL, 25),
  (8, 'yt_dhm_church', 'Subscribed: Dag Heward-Mills Church', NULL, 26),
  (8, 'yt_dhm_international', 'Subscribed: Dag Heward-Mills International Ministry', NULL, 27),
  (8, 'yt_dhm_crusades', 'Subscribed: Dag Heward-Mills Crusades', NULL, 28),
  (8, 'yt_dhm_documentaries', 'Subscribed: Dag Heward-Mills Documentaries', NULL, 29),
  (8, 'makarios_books', 'All the books in the Makarios collection loaded on their phone', NULL, 30),
  (8, 'dag_sermons_app', 'Dag Sermons app installed; knows how to search for messages', NULL, 40),
  (8, 'flc_music_shortcut', 'Phone shortcut to the First Love Music website; knows how to use it', NULL, 50),
  (8, 'dag_preaching_shortcut', 'Phone shortcut to the Dag Preaching website; knows how to use it', NULL, 51),
  (8, 'follow_dhm', 'Follows Dag Heward-Mills on Facebook, Instagram, X and TikTok', NULL, 60),
  (8, 'follow_flc', 'Follows First Love Church on Facebook, Instagram, X, Snapchat and TikTok', NULL, 61),
  (8, 'follow_lead_pastor', 'Follows the Lead Pastor on Facebook, Instagram, X and TikTok', NULL, 62),
  (8, 'camp_overcometh', 'Downloaded the camp "Who is He that Overcometh the World"',
     'https://www.mediafire.com/folder/rzn3iauwpwk3x/Who_is_He_That_Overcomes_The_World', 70),
  (8, 'messages', 'Downloaded the set messages',
     $h$7 Types of Women You Shouldn't Marry, Zero to Hero, The Dunamis Anointing, Basic Spiritual Forces, The Key of Concentration, Boys in Danger, Girls in Danger (download links are in the CCG Manual).$h$, 71),
  (9, 'interaction_meeting', 'Has been for an interaction meeting with the CCG Overseer', NULL, 10),
  (9, 'self_introduction', 'Introduced themselves to the Overseer and told him their name', NULL, 20),
  (9, 'laying_on_of_hands', 'The Overseer has laid hands on them', NULL, 30),
  (9, 'photo_with_overseer', 'Took a picture alone with the Overseer (not a group picture)', NULL, 40)
) AS i(stage, key, label, help, sort_order) ON i.stage = m.stage_number
WHERE m.kind = 'checklist'
ON CONFLICT (milestone_id, key) DO NOTHING;

INSERT INTO ccg_activity_types (key, name, cadence, schedule, lists_people, guidance, sort_order) VALUES
  ('intercession', 'Weekly half hour of intercession', 'weekly', 'Wednesday 5:00–5:30am', TRUE,
    $g$Every CCG meets on Wednesday morning, 5:00–5:30am, to pray for the members they are following up and mention them before God by name. Prayer topics:
1. That Christ is formed in them (Galatians 4:19).
2. That they are strengthened in the inner man (Ephesians 3:14-16).
3. That they are planted and permanent in the house of God (Psalm 92:13-14).
4. That they love God with all their heart, soul and mind (2 Thessalonians 3:5).
5. That they love God's house and God's people, and no longer enjoy the company of sinners (Psalm 26:8-9).$g$, 1),
  ('fellowship_meal', 'Informal fellowship over food', 'quarterly', 'Once a quarter', FALSE,
    $g$Every CCG organises a quarterly informal outing for all members, with food and time for conversation, so newer members build real relationships. Choose an appropriate place. Alcohol, drug use and any overtly sinful practice must be strongly prevented by the leaders.$g$, 2)
ON CONFLICT (key) DO NOTHING;

COMMIT;
