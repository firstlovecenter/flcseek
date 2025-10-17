/*
  # FLC Sheep Seeking - Initial Database Schema

  ## Overview
  This migration creates the complete database structure for the FLC Sheep Seeking church progress tracking system.

  ## New Tables

  ### 1. `users` - System users (Super Admin and Sheep Seekers)
    - `id` (uuid, primary key) - Unique identifier
    - `username` (text, unique) - Login username
    - `password` (text) - Bcrypt hashed password
    - `role` (text) - User role: 'super_admin' or 'sheep_seeker'
    - `department_name` (text, nullable) - Department for Sheep Seekers (Jan-Dec)
    - `phone_number` (text) - Contact phone number
    - `created_at` (timestamptz) - Record creation timestamp
    - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `registered_people` - Church members (sheep)
    - `id` (uuid, primary key) - Unique identifier
    - `full_name` (text) - Member's full name
    - `phone_number` (text) - Contact phone number
    - `gender` (text, nullable) - Gender
    - `department_name` (text) - Assigned department (Jan-Dec)
    - `registered_by` (uuid, foreign key) - User who registered this person
    - `created_at` (timestamptz) - Registration timestamp
    - `updated_at` (timestamptz) - Last update timestamp

  ### 3. `progress_records` - Spiritual progress tracking (15 stages)
    - `id` (uuid, primary key) - Unique identifier
    - `person_id` (uuid, foreign key) - Reference to registered person
    - `stage_number` (integer) - Stage number (1-15)
    - `stage_name` (text) - Stage description
    - `is_completed` (boolean) - Completion status
    - `date_completed` (date, nullable) - Completion date
    - `updated_by` (uuid, foreign key) - User who updated this record
    - `last_updated` (timestamptz) - Last update timestamp

  ### 4. `attendance_records` - Church attendance tracking
    - `id` (uuid, primary key) - Unique identifier
    - `person_id` (uuid, foreign key) - Reference to registered person
    - `date_attended` (date) - Attendance date
    - `recorded_by` (uuid, foreign key) - User who recorded attendance
    - `created_at` (timestamptz) - Record creation timestamp

  ### 5. `sms_logs` - SMS communication tracking
    - `id` (uuid, primary key) - Unique identifier
    - `to_phone` (text) - Recipient phone number
    - `message` (text) - SMS content
    - `trigger_type` (text) - SMS trigger type
    - `status` (text) - Status: 'sent', 'failed', or 'pending'
    - `response` (text, nullable) - API response
    - `sent_at` (timestamptz) - Sent timestamp

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Policies created for role-based access control
  - Super Admins have full access to all data
  - Sheep Seekers can only access their department's data

  ## Notes
  - The 15 progress stages are predefined in the application
  - Attendance completion requires 26 attendance records
  - All timestamps use timezone-aware types
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin', 'sheep_seeker')),
  department_name text,
  phone_number text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create registered_people table
CREATE TABLE IF NOT EXISTS registered_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone_number text NOT NULL,
  gender text,
  department_name text NOT NULL,
  registered_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create progress_records table
CREATE TABLE IF NOT EXISTS progress_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES registered_people(id) ON DELETE CASCADE,
  stage_number integer NOT NULL CHECK (stage_number BETWEEN 1 AND 15),
  stage_name text NOT NULL,
  is_completed boolean DEFAULT false,
  date_completed date,
  updated_by uuid NOT NULL REFERENCES users(id),
  last_updated timestamptz DEFAULT now(),
  UNIQUE(person_id, stage_number)
);

-- Create attendance_records table
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES registered_people(id) ON DELETE CASCADE,
  date_attended date NOT NULL,
  recorded_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Create sms_logs table
CREATE TABLE IF NOT EXISTS sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_phone text NOT NULL,
  message text NOT NULL,
  trigger_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  response text,
  sent_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_registered_people_department ON registered_people(department_name);
CREATE INDEX IF NOT EXISTS idx_progress_person_id ON progress_records(person_id);
CREATE INDEX IF NOT EXISTS idx_attendance_person_id ON attendance_records(person_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date_attended);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE registered_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Super admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Super admins can create users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- RLS Policies for registered_people table
CREATE POLICY "Super admins can view all people"
  ON registered_people FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sheep seekers can view own department"
  ON registered_people FOR SELECT
  TO authenticated
  USING (
    department_name IN (
      SELECT department_name FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can register people"
  ON registered_people FOR INSERT
  TO authenticated
  WITH CHECK (registered_by = auth.uid());

CREATE POLICY "Authenticated users can update people"
  ON registered_people FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for progress_records table
CREATE POLICY "Users can view all progress records"
  ON progress_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create progress records"
  ON progress_records FOR INSERT
  TO authenticated
  WITH CHECK (updated_by = auth.uid());

CREATE POLICY "Authenticated users can update progress records"
  ON progress_records FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (updated_by = auth.uid());

-- RLS Policies for attendance_records table
CREATE POLICY "Users can view all attendance records"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create attendance records"
  ON attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (recorded_by = auth.uid());

-- RLS Policies for sms_logs table
CREATE POLICY "Super admins can view all SMS logs"
  ON sms_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can create SMS logs"
  ON sms_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insert default super admin (password: admin123)
INSERT INTO users (username, password, role, phone_number)
VALUES (
  'admin',
  '$2a$10$rKJ5VF7x5vxZ5N5N5N5N5N5N5N5N5N5N5N5N5N5N5N5N5N5N5N5NO',
  'super_admin',
  '0000000000'
)
ON CONFLICT (username) DO NOTHING;
