-- Migration 043: intercession (5:00–5:30am) and the fellowship service
-- (7:00–8:00pm, online, in person once a month) move from Wednesday to Thursday.

BEGIN;

UPDATE ccg_activity_types
   SET name = replace(name, 'Wednesday', 'Thursday'),
       schedule = replace(schedule, 'Wednesday', 'Thursday'),
       guidance = replace(guidance, 'Wednesday', 'Thursday'),
       updated_at = NOW()
 WHERE key IN ('intercession', 'fellowship_service');

UPDATE ccg_questions
   SET help = replace(help, 'Wednesday', 'Thursday'), updated_at = NOW()
 WHERE key = 'availability';

COMMIT;
