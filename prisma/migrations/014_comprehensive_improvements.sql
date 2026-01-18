-- =============================================================================
-- FLCSeek Comprehensive Improvements Migration
-- Run this migration to add all recommended improvements
-- =============================================================================

-- =============================================================================
-- 1. ADD is_auto_calculated TO MILESTONES
-- Purpose: Replace hardcoded milestone 18 check with database-driven flag
-- =============================================================================
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS is_auto_calculated BOOLEAN DEFAULT FALSE;

-- Set milestone 18 (Attendance) as auto-calculated
UPDATE milestones SET is_auto_calculated = TRUE WHERE stage_number = 18;

-- Index for auto-calculated queries
CREATE INDEX IF NOT EXISTS idx_milestones_auto_calculated ON milestones(is_auto_calculated);

-- =============================================================================
-- 2. ADD SOFT DELETE SUPPORT
-- Purpose: Allow recovering deleted records instead of permanent deletion
-- =============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE new_converts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Indexes for soft delete queries
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_new_converts_deleted_at ON new_converts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_groups_deleted_at ON groups(deleted_at) WHERE deleted_at IS NULL;

-- =============================================================================
-- 3. CREATE ACTIVITY LOGS TABLE (AUDIT TRAIL)
-- Purpose: Track all important actions for accountability
-- =============================================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- 'LOGIN', 'LOGOUT', 'CREATE_CONVERT', 'UPDATE_PROGRESS', etc.
  entity_type VARCHAR(50), -- 'user', 'new_convert', 'group', 'milestone', 'progress', 'attendance'
  entity_id UUID, -- ID of the affected record
  old_values JSONB, -- Previous values (for updates)
  new_values JSONB, -- New values (for creates/updates)
  ip_address VARCHAR(45), -- IPv4 or IPv6
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for activity log queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- =============================================================================
-- 4. CREATE USER_GROUPS JUNCTION TABLE (MULTI-GROUP ACCESS)
-- Purpose: Allow users to be assigned to multiple groups (same month, different years)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE, -- Primary group for the user
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Each user can only be assigned to a group once
  CONSTRAINT user_groups_unique UNIQUE (user_id, group_id)
);

-- Indexes for user_groups queries
CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON user_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON user_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_primary ON user_groups(is_primary) WHERE is_primary = TRUE;

-- =============================================================================
-- 5. CREATE PASSWORD RESET TOKENS TABLE
-- Purpose: Support password reset functionality
-- =============================================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- =============================================================================
-- 6. CREATE NOTIFICATIONS TABLE
-- Purpose: Store notifications for users (birthdays, inactive converts, etc.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'BIRTHDAY', 'INACTIVE_CONVERT', 'MILESTONE_ACHIEVEMENT', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT,
  entity_type VARCHAR(50), -- 'new_convert', 'group', etc.
  entity_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- =============================================================================
-- 7. ADD RATE LIMITING TABLE
-- Purpose: Track API request counts for rate limiting
-- =============================================================================
CREATE TABLE IF NOT EXISTS rate_limit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(255) NOT NULL, -- IP address or user ID
  endpoint VARCHAR(255) NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One record per identifier per endpoint per time window
  CONSTRAINT rate_limit_unique UNIQUE (identifier, endpoint, window_start)
);

-- Index for rate limit lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON rate_limit_records(identifier, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_records(window_start);

-- Auto-cleanup old rate limit records (can be run periodically)
-- DELETE FROM rate_limit_records WHERE window_start < NOW() - INTERVAL '1 hour';

-- =============================================================================
-- 8. MIGRATE EXISTING USER GROUP ASSIGNMENTS TO user_groups TABLE
-- Purpose: Copy current user.group_id relationships to the junction table
-- =============================================================================
INSERT INTO user_groups (user_id, group_id, is_primary)
SELECT id, group_id, TRUE
FROM users
WHERE group_id IS NOT NULL
ON CONFLICT (user_id, group_id) DO NOTHING;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'FLCSeek Comprehensive Improvements Migration Complete!';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Changes Applied:';
  RAISE NOTICE '  ✅ Added is_auto_calculated column to milestones';
  RAISE NOTICE '  ✅ Added soft delete (deleted_at) columns';
  RAISE NOTICE '  ✅ Created activity_logs table for audit trail';
  RAISE NOTICE '  ✅ Created user_groups junction table for multi-group access';
  RAISE NOTICE '  ✅ Created password_reset_tokens table';
  RAISE NOTICE '  ✅ Created notifications table';
  RAISE NOTICE '  ✅ Created rate_limit_records table';
  RAISE NOTICE '  ✅ Migrated existing user group assignments';
  RAISE NOTICE '=============================================================================';
END $$;
