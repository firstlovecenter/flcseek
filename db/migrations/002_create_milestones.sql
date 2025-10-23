-- Create milestones table to manage milestones dynamically
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_number integer UNIQUE NOT NULL,
  stage_name text NOT NULL,
  short_name text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert the existing 18 milestones
INSERT INTO milestones (stage_number, stage_name, short_name, description) VALUES
  (1, 'Completed New Believers School', 'NB\nSchool', 'Member has successfully completed the New Believers School program'),
  (2, 'Completed Soul-Winning School', 'SW\nSchool', 'Member has successfully completed the Soul-Winning School training'),
  (3, 'Visited (First Quarter)', 'First\nVisit', 'Member was visited during the first quarter of the year'),
  (4, 'Visited (Second Quarter)', 'Second\nVisit', 'Member was visited during the second quarter of the year'),
  (5, 'Visited (Third Quarter)', 'Third\nVisit', 'Member was visited during the third quarter of the year'),
  (6, 'Baptised in Water', 'Water\nBaptism', 'Member has been baptized in water'),
  (7, 'Baptised in the Holy Ghost', 'HG\nBaptism', 'Member has been baptized in the Holy Spirit'),
  (8, 'Joined Basonta or Creative Arts', 'Joined\nBasonta', 'Member has joined either Basonta or Creative Arts ministry'),
  (9, 'Completed Seeing & Hearing Education', 'Seeing &\nHearing', 'Member has completed the Seeing & Hearing Education program'),
  (10, 'Introduced to Lead Pastor', 'LP\nIntro', 'Member has been formally introduced to the Lead Pastor'),
  (11, 'Introduced to a First Love Mother', 'Mother\nIntro', 'Member has been introduced to and connected with a First Love Mother'),
  (12, 'Attended Church Social Outing', 'Church\nSocial', 'Member has participated in a church social outing event'),
  (13, 'Attended All-Night Prayer', 'All\nNight', 'Member has attended an All-Night Prayer session'),
  (14, 'Attended "Meeting God"', 'Meeting\nGod', 'Member has attended the "Meeting God" event/program'),
  (15, 'Invited a Friend to Church', 'Friend\nInvited', 'Member has invited a friend to attend church'),
  (16, 'Attended Ministry Training', 'Ministry\nTraining', 'Member has participated in ministry training'),
  (17, 'Joined a Cell Group', 'Cell\nGroup', 'Member has joined and actively participates in a Cell Group'),
  (18, 'Completed First Year Milestone', 'First Year', 'Member has successfully completed their first year milestone')
ON CONFLICT (stage_number) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_milestones_number ON milestones(stage_number);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_milestones_updated_at 
  BEFORE UPDATE ON milestones 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
