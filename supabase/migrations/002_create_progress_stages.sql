-- Create progress_stages table to manage milestones dynamically
CREATE TABLE IF NOT EXISTS progress_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_number integer UNIQUE NOT NULL,
  stage_name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert the existing 18 milestones
INSERT INTO progress_stages (stage_number, stage_name, description) VALUES
  (1, 'Completed New Believers School', 'Member has successfully completed the New Believers School program'),
  (2, 'Completed Soul-Winning School', 'Member has successfully completed the Soul-Winning School training'),
  (3, 'Visited (First Quarter)', 'Member was visited during the first quarter of the year'),
  (4, 'Visited (Second Quarter)', 'Member was visited during the second quarter of the year'),
  (5, 'Visited (Third Quarter)', 'Member was visited during the third quarter of the year'),
  (6, 'Baptised in Water', 'Member has been baptized in water'),
  (7, 'Baptised in the Holy Ghost', 'Member has been baptized in the Holy Spirit'),
  (8, 'Joined Basonta or Creative Arts', 'Member has joined either Basonta or Creative Arts ministry'),
  (9, 'Completed Seeing & Hearing Education', 'Member has completed the Seeing & Hearing Education program'),
  (10, 'Introduced to Lead Pastor', 'Member has been formally introduced to the Lead Pastor'),
  (11, 'Introduced to a First Love Mother', 'Member has been introduced to and connected with a First Love Mother'),
  (12, 'Attended Church Social Outing', 'Member has participated in a church social outing event'),
  (13, 'Attended All-Night Prayer', 'Member has attended an All-Night Prayer session'),
  (14, 'Attended "Meeting God"', 'Member has attended the "Meeting God" event/program'),
  (15, 'Invited a Friend to Church', 'Member has invited a friend to attend church'),
  (16, 'Attended Ministry Training', 'Member has participated in ministry training'),
  (17, 'Joined a Cell Group', 'Member has joined and actively participates in a Cell Group'),
  (18, 'Completed First Year Milestone', 'Member has successfully completed their first year milestone')
ON CONFLICT (stage_number) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_progress_stages_number ON progress_stages(stage_number);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_progress_stages_updated_at 
  BEFORE UPDATE ON progress_stages 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
