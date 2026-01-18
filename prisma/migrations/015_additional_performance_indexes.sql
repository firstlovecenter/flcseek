-- Additional Performance Indexes for Common Query Patterns
-- Run this migration to add indexes that optimize frequently used queries

-- Composite index on new_converts for group-based queries with ordering
CREATE INDEX IF NOT EXISTS idx_new_converts_group_name 
ON new_converts(group_id, first_name, last_name)
WHERE deleted_at IS NULL;

-- Composite index for progress record queries (person + completion status)
CREATE INDEX IF NOT EXISTS idx_progress_person_completed 
ON progress_records(person_id, is_completed, stage_number);

-- Composite index for attendance queries by person and date range
CREATE INDEX IF NOT EXISTS idx_attendance_person_date 
ON attendance_records(person_id, date_attended DESC);

-- Index on groups for active year-based filtering (most common query)
CREATE INDEX IF NOT EXISTS idx_groups_active_year 
ON groups(year, archived)
WHERE archived = false OR archived IS NULL;

-- Covering index for new_converts basic queries (avoid table lookups)
CREATE INDEX IF NOT EXISTS idx_new_converts_covering 
ON new_converts(group_id, first_name, last_name, phone_number, deleted_at)
WHERE deleted_at IS NULL;

-- Index for user role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role_active 
ON users(role, group_id)
WHERE deleted_at IS NULL;

-- Partial index for completed progress records only (reduces index size)
CREATE INDEX IF NOT EXISTS idx_progress_completed_only 
ON progress_records(person_id, stage_number, date_completed)
WHERE is_completed = true;

-- Index for activity logs time-based queries
CREATE INDEX IF NOT EXISTS idx_activity_recent 
ON activity_logs(created_at DESC, user_id, entity_type)
WHERE created_at > NOW() - INTERVAL '30 days';

-- Composite index for notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_id, is_read, created_at DESC)
WHERE is_read = false;
