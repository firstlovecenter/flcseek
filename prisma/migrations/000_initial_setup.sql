-- FLCSeek Database Initial Setup
-- This migration file creates the complete database schema from scratch
-- Run this ONCE when setting up a new instance of FLCSeek

-- =============================================================================
-- TABLE: users
-- Purpose: Store all user accounts (superadmin, lead pastor, admin, leader)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL, -- bcrypt hashed
  role VARCHAR(50), -- 'superadmin', 'leadpastor', 'admin', 'leader'
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  group_id UUID, -- References groups.id (added via FK later)
  group_name VARCHAR(255), -- Legacy field for backwards compatibility
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint on email (only if not null)
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users(email) WHERE email IS NOT NULL;

-- Index for faster role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Index for group lookups
CREATE INDEX IF NOT EXISTS idx_users_group_id ON users(group_id);
CREATE INDEX IF NOT EXISTS idx_users_group_name ON users(group_name);

-- =============================================================================
-- TABLE: groups
-- Purpose: Represent month-based groups (January 2025, February 2025, etc.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL, -- Month name: 'January', 'February', etc.
  year INTEGER NOT NULL DEFAULT 2025,
  description TEXT,
  leader_id UUID, -- References users.id
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one group per month per year
  CONSTRAINT groups_name_year_unique UNIQUE (name, year)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_groups_year ON groups(year);
CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);
CREATE INDEX IF NOT EXISTS idx_groups_name_year ON groups(name, year);
CREATE INDEX IF NOT EXISTS idx_groups_leader_id ON groups(leader_id);
CREATE INDEX IF NOT EXISTS idx_groups_archived ON groups(archived);
CREATE INDEX IF NOT EXISTS idx_groups_year_archived ON groups(year, archived);

-- =============================================================================
-- TABLE: milestones
-- Purpose: Define spiritual growth stages (18 milestones)
-- =============================================================================
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_number INTEGER UNIQUE NOT NULL, -- 1-18 (or more)
  stage_name VARCHAR(255) NOT NULL,
  short_name VARCHAR(100), -- Abbreviated name for display
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_milestones_stage_number ON milestones(stage_number);

-- =============================================================================
-- TABLE: new_converts
-- Purpose: Store information about registered new converts
-- =============================================================================
CREATE TABLE IF NOT EXISTS new_converts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(20),
  residential_location VARCHAR(255), -- Home address
  school_residential_location TEXT, -- School/campus location
  occupation_type VARCHAR(100), -- Student, Professional, etc.
  home_location VARCHAR(255), -- Legacy field (use residential_location)
  work_location TEXT, -- Legacy field (use school_residential_location)
  group_id UUID, -- References groups.id
  group_name VARCHAR(255), -- Legacy field (use group_id)
  registered_by UUID, -- References users.id (sheep seeker who registered)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique phone number constraint
  CONSTRAINT unique_phone_number UNIQUE (phone_number)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_new_converts_group_id ON new_converts(group_id);
CREATE INDEX IF NOT EXISTS idx_new_converts_group_name ON new_converts(group_name);
CREATE INDEX IF NOT EXISTS idx_new_converts_phone ON new_converts(phone_number);
CREATE INDEX IF NOT EXISTS idx_new_converts_registered_by ON new_converts(registered_by);
CREATE INDEX IF NOT EXISTS idx_new_converts_created_at ON new_converts(created_at);

-- =============================================================================
-- TABLE: progress_records
-- Purpose: Track milestone completion for each new convert
-- =============================================================================
CREATE TABLE IF NOT EXISTS progress_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL, -- References new_converts.id
  stage_number INTEGER NOT NULL,
  stage_name VARCHAR(255) NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  date_completed DATE,
  updated_by UUID, -- References users.id (who marked it complete)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one record per person per stage
  CONSTRAINT progress_records_person_stage_unique UNIQUE (person_id, stage_number)
);

-- Performance indexes (critical for JOIN operations)
CREATE INDEX IF NOT EXISTS idx_progress_records_person_id ON progress_records(person_id);
CREATE INDEX IF NOT EXISTS idx_progress_records_person_stage ON progress_records(person_id, stage_number);
CREATE INDEX IF NOT EXISTS idx_progress_records_completed ON progress_records(is_completed) WHERE is_completed = true;
CREATE INDEX IF NOT EXISTS idx_progress_records_updated_by ON progress_records(updated_by);

-- =============================================================================
-- TABLE: attendance_records
-- Purpose: Track church attendance for each new convert
-- =============================================================================
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL, -- References new_converts.id
  attendance_date DATE NOT NULL,
  marked_by UUID, -- References users.id
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one attendance record per person per date
  CONSTRAINT attendance_person_date_unique UNIQUE (person_id, attendance_date)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_records_person_id ON attendance_records(person_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_marked_by ON attendance_records(marked_by);

-- =============================================================================
-- FOREIGN KEY CONSTRAINTS
-- Purpose: Enforce referential integrity
-- =============================================================================

-- users.group_id -> groups.id
ALTER TABLE users 
  DROP CONSTRAINT IF EXISTS users_group_id_fkey;
ALTER TABLE users 
  ADD CONSTRAINT users_group_id_fkey 
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;

-- groups.leader_id -> users.id
ALTER TABLE groups 
  DROP CONSTRAINT IF EXISTS groups_leader_id_fkey;
ALTER TABLE groups 
  ADD CONSTRAINT groups_leader_id_fkey 
  FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL;

-- new_converts.group_id -> groups.id
ALTER TABLE new_converts 
  DROP CONSTRAINT IF EXISTS new_converts_group_id_fkey;
ALTER TABLE new_converts 
  ADD CONSTRAINT new_converts_group_id_fkey 
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;

-- new_converts.registered_by -> users.id
ALTER TABLE new_converts 
  DROP CONSTRAINT IF EXISTS new_converts_registered_by_fkey;
ALTER TABLE new_converts 
  ADD CONSTRAINT new_converts_registered_by_fkey 
  FOREIGN KEY (registered_by) REFERENCES users(id) ON DELETE SET NULL;

-- progress_records.person_id -> new_converts.id
ALTER TABLE progress_records 
  DROP CONSTRAINT IF EXISTS progress_records_person_id_fkey;
ALTER TABLE progress_records 
  ADD CONSTRAINT progress_records_person_id_fkey 
  FOREIGN KEY (person_id) REFERENCES new_converts(id) ON DELETE CASCADE;

-- progress_records.updated_by -> users.id
ALTER TABLE progress_records 
  DROP CONSTRAINT IF EXISTS progress_records_updated_by_fkey;
ALTER TABLE progress_records 
  ADD CONSTRAINT progress_records_updated_by_fkey 
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- attendance_records.person_id -> new_converts.id
ALTER TABLE attendance_records 
  DROP CONSTRAINT IF EXISTS attendance_records_person_id_fkey;
ALTER TABLE attendance_records 
  ADD CONSTRAINT attendance_records_person_id_fkey 
  FOREIGN KEY (person_id) REFERENCES new_converts(id) ON DELETE CASCADE;

-- attendance_records.marked_by -> users.id
ALTER TABLE attendance_records 
  DROP CONSTRAINT IF EXISTS attendance_records_marked_by_fkey;
ALTER TABLE attendance_records 
  ADD CONSTRAINT attendance_records_marked_by_fkey 
  FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL;

-- =============================================================================
-- SEED DATA: Default Super Admin User
-- Purpose: Create initial superadmin account for system setup and management
-- Username: superadmin
-- Password: admin123 (CHANGE THIS IMMEDIATELY AFTER FIRST LOGIN!)
-- =============================================================================
-- Password hash for 'admin123' using bcrypt (cost factor: 10)
INSERT INTO users (id, username, password, role, first_name, last_name, created_at)
VALUES (
  gen_random_uuid(),
  'superadmin',
  '$2a$10$XQK9c5J5R.QF5Y0YKVk8HOJyPmrqOYqXqHPxQZxQZUJGZKZQZxQZU', -- admin123
  'superadmin',
  'System',
  'Administrator',
  NOW()
)
ON CONFLICT (username) DO NOTHING;

-- =============================================================================
-- SEED DATA: Default Milestones (18 Spiritual Growth Stages)
-- Purpose: Initialize the standard milestone progression
-- =============================================================================
INSERT INTO milestones (stage_number, stage_name, short_name, description, created_at) VALUES
  (1, 'First Attendance', 'First', 'Attended first church service', NOW()),
  (2, 'Foundation Class', 'Foundation', 'Completed foundation class for new believers', NOW()),
  (3, 'Connect Group', 'Connect', 'Joined a connect group/cell group', NOW()),
  (4, 'Baptism', 'Baptism', 'Water baptism completed', NOW()),
  (5, 'Membership Class', 'Membership', 'Attended church membership class', NOW()),
  (6, 'Church Member', 'Member', 'Officially registered as church member', NOW()),
  (7, 'Volunteer Service', 'Volunteer', 'Serving in a church ministry', NOW()),
  (8, 'Regular Giver', 'Giving', 'Consistent in tithes and offerings', NOW()),
  (9, 'Soul Winner', 'Soul Winner', 'Led someone to Christ', NOW()),
  (10, 'Bible Study', 'Bible Study', 'Regular Bible study participation', NOW()),
  (11, 'Prayer Meeting', 'Prayer', 'Attending weekly prayer meetings', NOW()),
  (12, 'Leadership Training', 'Leadership', 'Enrolled in leadership development', NOW()),
  (13, 'Mentor Assigned', 'Mentor', 'Has spiritual mentor/discipler', NOW()),
  (14, 'Scripture Memory', 'Scripture', 'Memorizing key Bible verses', NOW()),
  (15, 'Ministry Team', 'Ministry', 'Active member of ministry team', NOW()),
  (16, 'Evangelism', 'Evangelism', 'Participating in outreach programs', NOW()),
  (17, 'Spiritual Gifts', 'Gifts', 'Discovered and using spiritual gifts', NOW()),
  (18, 'Mature Believer', 'Mature', 'Demonstrating spiritual maturity', NOW())
ON CONFLICT (stage_number) DO NOTHING;

-- =============================================================================
-- SEED DATA: Default Groups (12 Months for Current Year)
-- Purpose: Create groups for each month of 2025
-- =============================================================================
INSERT INTO groups (name, year, description, created_at) VALUES
  ('January', 2025, 'New converts registered in January 2025', NOW()),
  ('February', 2025, 'New converts registered in February 2025', NOW()),
  ('March', 2025, 'New converts registered in March 2025', NOW()),
  ('April', 2025, 'New converts registered in April 2025', NOW()),
  ('May', 2025, 'New converts registered in May 2025', NOW()),
  ('June', 2025, 'New converts registered in June 2025', NOW()),
  ('July', 2025, 'New converts registered in July 2025', NOW()),
  ('August', 2025, 'New converts registered in August 2025', NOW()),
  ('September', 2025, 'New converts registered in September 2025', NOW()),
  ('October', 2025, 'New converts registered in October 2025', NOW()),
  ('November', 2025, 'New converts registered in November 2025', NOW()),
  ('December', 2025, 'New converts registered in December 2025', NOW())
ON CONFLICT (name, year) DO NOTHING;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'FLCSeek Database Setup Complete!';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Tables Created:';
  RAISE NOTICE '  ✅ users (with default superadmin account)';
  RAISE NOTICE '  ✅ groups (12 months for 2025)';
  RAISE NOTICE '  ✅ milestones (18 spiritual growth stages)';
  RAISE NOTICE '  ✅ new_converts (convert registration)';
  RAISE NOTICE '  ✅ progress_records (milestone tracking)';
  RAISE NOTICE '  ✅ attendance_records (attendance tracking)';
  RAISE NOTICE '';
  RAISE NOTICE 'Default Superadmin Login:';
  RAISE NOTICE '  Username: superadmin';
  RAISE NOTICE '  Password: admin123';
  RAISE NOTICE '  Role: superadmin (full system access)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Login and CHANGE the superadmin password immediately';
  RAISE NOTICE '  2. Create month groups and assign leaders';
  RAISE NOTICE '  3. Create user accounts for admins and leaders';
  RAISE NOTICE '  4. Customize milestones if needed';
  RAISE NOTICE '  5. Start registering new converts!';
  RAISE NOTICE '=============================================================================';
END $$;
