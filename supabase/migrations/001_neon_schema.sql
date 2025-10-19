-- FLC Sheep Seeking - Neon Database Schema
-- Simplified version without Supabase RLS policies

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin', 'sheep_seeker')),
  phone_number text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  leader_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create registered_people table
CREATE TABLE IF NOT EXISTS registered_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone_number text NOT NULL,
  gender text,
  home_location text,
  work_location text,
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

-- Insert default super admin (password: admin123)
INSERT INTO users (username, password, role, phone_number)
VALUES (
  'admin',
  '$2b$10$T2uo.gNNvcBAGF/jWp9RD.XFCDT.mhFKUIOhK//gqW0/n6tgmtOVu',
  'super_admin',
  '0000000000'
)
ON CONFLICT (username) DO NOTHING;
