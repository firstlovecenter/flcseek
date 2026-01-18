-- Performance optimization indexes
-- These indexes significantly speed up JOIN operations and WHERE clauses

-- Index on progress_records.person_id for faster JOIN with new_converts
CREATE INDEX IF NOT EXISTS idx_progress_records_person_id 
ON progress_records(person_id);

-- Composite index on progress_records for filtering by person and stage
CREATE INDEX IF NOT EXISTS idx_progress_records_person_stage 
ON progress_records(person_id, stage_number);

-- Index on progress_records.is_completed for faster filtering of completed stages
CREATE INDEX IF NOT EXISTS idx_progress_records_completed 
ON progress_records(is_completed) 
WHERE is_completed = true;

-- Index on new_converts.group_id for faster filtering by group
CREATE INDEX IF NOT EXISTS idx_new_converts_group_id 
ON new_converts(group_id);

-- Index on new_converts.group_name for legacy group filtering
CREATE INDEX IF NOT EXISTS idx_new_converts_group_name 
ON new_converts(group_name);

-- Index on attendance_records.person_id for faster attendance lookups
CREATE INDEX IF NOT EXISTS idx_attendance_records_person_id 
ON attendance_records(person_id);

-- Index on groups.name for month-based filtering
CREATE INDEX IF NOT EXISTS idx_groups_name 
ON groups(name);

-- Composite index on groups for month-year filtering
CREATE INDEX IF NOT EXISTS idx_groups_name_year 
ON groups(name, year);

-- Index on new_converts.phone_number for faster duplicate checks
-- (already has unique constraint, but explicit index helps with lookups)
CREATE INDEX IF NOT EXISTS idx_new_converts_phone 
ON new_converts(phone_number);
