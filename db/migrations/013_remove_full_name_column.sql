-- Migration: Remove full_name column from new_converts table
-- Description: The full_name column is redundant as we now compute it dynamically from first_name and last_name
-- Date: 2025-10-26

-- Remove the full_name column from new_converts table
ALTER TABLE new_converts DROP COLUMN IF EXISTS full_name;

-- Note: All API endpoints now compute full_name dynamically using CONCAT(first_name, ' ', last_name)
-- This ensures data consistency and eliminates redundancy
