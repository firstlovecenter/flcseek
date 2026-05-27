-- Migration 015: Partial unique phone index + composite indexes
--
-- Problem: The existing unique constraint on new_converts.phone_number
-- prevents re-registration of a number that was soft-deleted (deleted_at IS NOT NULL).
-- A partial unique index that only applies to non-deleted rows fixes this.
--
-- Also adds composite indexes for the most common query patterns.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Replace full unique constraint with a partial unique index
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the old full unique constraint
ALTER TABLE new_converts DROP CONSTRAINT IF EXISTS unique_phone_number;

-- Add partial unique index — only active (non-deleted) rows are constrained.
-- CONCURRENTLY avoids a full table lock on large datasets.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_phone_number_active
  ON new_converts (phone_number)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Composite indexes for common query patterns
-- ─────────────────────────────────────────────────────────────────────────────

-- Most frequent filter: active converts within a specific group
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_new_converts_group_active
  ON new_converts (group_id, deleted_at);

-- Leader-scoped queries: "show me converts I registered in this group"
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_new_converts_registered_group
  ON new_converts (registered_by, group_id);

-- Name search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_new_converts_name
  ON new_converts (first_name, last_name);
