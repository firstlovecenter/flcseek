-- Migration: Add is_active column to milestones table
-- Purpose: Allow toggling milestones active/inactive
-- Date: 2025-10-28

ALTER TABLE milestones 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Set all existing milestones to active by default
UPDATE milestones SET is_active = true WHERE is_active IS NULL;

-- Add index for filtering active milestones
CREATE INDEX IF NOT EXISTS idx_milestones_is_active ON milestones(is_active);
