-- ============================================================================
-- Migration: 017_add_advanced_features
-- Description: Add tables and fields for advanced features including:
--   - Achievement Badges system
--   - Alert Rules and Convert Alerts for performance monitoring
--   - Saved Searches for quick filtering
--   - Report Templates for customizable reports
--   - Analytics Snapshots for historical trend analysis
--   - Risk scoring and tracking for converts
--   - Auto-trigger configuration for milestones
-- Date: 2025
-- ============================================================================

-- ============================================================================
-- Step 1: Add new columns to existing tables
-- ============================================================================

-- Add risk tracking fields to new_converts table
ALTER TABLE new_converts 
ADD COLUMN IF NOT EXISTS risk_score INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_attendance_date DATE,
ADD COLUMN IF NOT EXISTS last_milestone_date DATE;

-- Add auto-trigger configuration and badge reference to milestones table
ALTER TABLE milestones 
ADD COLUMN IF NOT EXISTS auto_trigger_config JSONB,
ADD COLUMN IF NOT EXISTS badge_id UUID;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_new_converts_risk_score ON new_converts(risk_score);
CREATE INDEX IF NOT EXISTS idx_milestones_badge_id ON milestones(badge_id);

-- ============================================================================
-- Step 2: Create Achievement Badges table
-- ============================================================================

CREATE TABLE IF NOT EXISTS achievement_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL, -- {type: 'attendance', threshold: 26}
  icon VARCHAR(50),
  color VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievement_badges_is_active ON achievement_badges(is_active);

COMMENT ON TABLE achievement_badges IS 'Defines badge criteria and metadata for achievements';
COMMENT ON COLUMN achievement_badges.criteria IS 'JSON criteria defining when badge is earned (e.g., {"type":"attendance","threshold":26})';

-- ============================================================================
-- Step 3: Create User Badges table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  convert_id UUID REFERENCES new_converts(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES achievement_badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  CONSTRAINT user_or_convert_badge CHECK (
    (user_id IS NOT NULL AND convert_id IS NULL) OR 
    (user_id IS NULL AND convert_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_convert_id ON user_badges(convert_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_earned_at ON user_badges(earned_at);

COMMENT ON TABLE user_badges IS 'Tracks earned badges for users and converts';
COMMENT ON COLUMN user_badges.metadata IS 'Additional context about when/how badge was earned';

-- ============================================================================
-- Step 4: Create Saved Searches table
-- ============================================================================

CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  filters JSONB NOT NULL, -- Filter configuration
  is_smart BOOLEAN DEFAULT false, -- Dynamic filters
  is_public BOOLEAN DEFAULT false, -- Shareable with team
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_is_public ON saved_searches(is_public);

COMMENT ON TABLE saved_searches IS 'Saved filter configurations for quick access';
COMMENT ON COLUMN saved_searches.is_smart IS 'Whether search uses dynamic/smart filters';
COMMENT ON COLUMN saved_searches.is_public IS 'Whether search is visible to other team members';

-- ============================================================================
-- Step 5: Create Alert Rules table
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'attendance_drop', 'milestone_stall', 'missing'
  criteria JSONB NOT NULL, -- Alert conditions
  notification_channels JSONB, -- ['in_app', 'email', 'sms']
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON alert_rules(type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_is_active ON alert_rules(is_active);

COMMENT ON TABLE alert_rules IS 'Defines alert criteria and notification configuration';
COMMENT ON COLUMN alert_rules.type IS 'Alert type: attendance_drop, milestone_stall, missing, etc';
COMMENT ON COLUMN alert_rules.criteria IS 'JSON conditions for triggering alert';

-- ============================================================================
-- Step 6: Create Convert Alerts table
-- ============================================================================

CREATE TABLE IF NOT EXISTS convert_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convert_id UUID NOT NULL REFERENCES new_converts(id) ON DELETE CASCADE,
  alert_rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'acknowledged', 'resolved'
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'acknowledged', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_convert_alerts_convert_id ON convert_alerts(convert_id);
CREATE INDEX IF NOT EXISTS idx_convert_alerts_rule_id ON convert_alerts(alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_convert_alerts_status ON convert_alerts(status);
CREATE INDEX IF NOT EXISTS idx_convert_alerts_severity ON convert_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_convert_alerts_created_at ON convert_alerts(created_at);

COMMENT ON TABLE convert_alerts IS 'Active alerts for specific converts requiring attention';
COMMENT ON COLUMN convert_alerts.severity IS 'Alert severity: low, medium, high, critical';
COMMENT ON COLUMN convert_alerts.status IS 'Alert state: active, acknowledged, resolved';

-- ============================================================================
-- Step 7: Create Report Templates table
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  template_config JSONB NOT NULL, -- Sections, metrics, filters
  schedule_config JSONB, -- For scheduled reports
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON report_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_report_templates_is_public ON report_templates(is_public);

COMMENT ON TABLE report_templates IS 'Customizable report configurations';
COMMENT ON COLUMN report_templates.template_config IS 'JSON configuration for report sections, metrics, and filters';
COMMENT ON COLUMN report_templates.schedule_config IS 'Configuration for scheduled/recurring reports';

-- ============================================================================
-- Step 8: Create Analytics Snapshots table
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  group_id UUID REFERENCES groups(id),
  metrics JSONB NOT NULL, -- {totalConverts: 50, attendance: 45, etc}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_date ON analytics_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_group_id ON analytics_snapshots(group_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_date_group ON analytics_snapshots(snapshot_date, group_id);

COMMENT ON TABLE analytics_snapshots IS 'Historical data snapshots for trend analysis and forecasting';
COMMENT ON COLUMN analytics_snapshots.metrics IS 'JSON snapshot of metrics at specific date';

-- ============================================================================
-- Step 9: Add foreign key constraints
-- ============================================================================

-- Add foreign key from milestones to achievement_badges
ALTER TABLE milestones 
ADD CONSTRAINT fk_milestones_badge_id 
FOREIGN KEY (badge_id) REFERENCES achievement_badges(id);

-- ============================================================================
-- Step 10: Insert default alert rules
-- ============================================================================

INSERT INTO alert_rules (name, type, criteria, notification_channels, is_active) VALUES
  ('Attendance Drop Alert', 'attendance_drop', 
   '{"metric":"attendance_rate","threshold":0.5,"period":"4_weeks"}', 
   '["in_app","email"]', true),
  ('Milestone Stagnation', 'milestone_stall', 
   '{"metric":"days_since_milestone","threshold":30}', 
   '["in_app"]', true),
  ('Missing Convert', 'missing', 
   '{"metric":"consecutive_absences","threshold":3}', 
   '["in_app","email"]', true),
  ('High Risk Convert', 'high_risk', 
   '{"metric":"risk_score","threshold":70}', 
   '["in_app","email"]', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Step 11: Insert default achievement badges
-- ============================================================================

INSERT INTO achievement_badges (name, description, criteria, icon, color, is_active) VALUES
  ('Faithful Attendee', 'Attended 26+ weeks', 
   '{"type":"attendance","threshold":26,"period":"year"}', 
   'trophy', 'gold', true),
  ('Fast Learner', 'Completed 10 milestones in 6 months', 
   '{"type":"milestones","threshold":10,"period":"6_months"}', 
   'star', 'blue', true),
  ('Consistent Disciple', 'No absences for 8 weeks', 
   '{"type":"streak","threshold":8,"metric":"attendance"}', 
   'medal', 'green', true),
  ('Milestone Champion', 'Completed all 18 milestones', 
   '{"type":"milestone_complete","threshold":18}', 
   'crown', 'purple', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verify tables were created
DO $$
BEGIN
  RAISE NOTICE 'Migration 017 complete. New tables created:';
  RAISE NOTICE '  - achievement_badges';
  RAISE NOTICE '  - user_badges';
  RAISE NOTICE '  - saved_searches';
  RAISE NOTICE '  - alert_rules';
  RAISE NOTICE '  - convert_alerts';
  RAISE NOTICE '  - report_templates';
  RAISE NOTICE '  - analytics_snapshots';
  RAISE NOTICE 'Modified tables:';
  RAISE NOTICE '  - new_converts (added risk_score, last_attendance_date, last_milestone_date)';
  RAISE NOTICE '  - milestones (added auto_trigger_config, badge_id)';
END $$;
