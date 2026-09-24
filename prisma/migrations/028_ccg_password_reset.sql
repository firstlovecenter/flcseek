-- Migration 028: password reset
--
-- ccg_invites also carries password-reset links ("forgot password" on the
-- sign-in page). Same one-time, hashed tokens; resets expire after an hour.
--
-- Apply after 027:  npx tsx scripts/ccg-apply-migration.ts prisma/migrations/028_ccg_password_reset.sql

BEGIN;

ALTER TABLE ccg_invites ADD COLUMN IF NOT EXISTS purpose VARCHAR(10) NOT NULL DEFAULT 'invite';
ALTER TABLE ccg_invites DROP CONSTRAINT IF EXISTS ccg_invites_purpose_check;
ALTER TABLE ccg_invites ADD CONSTRAINT ccg_invites_purpose_check CHECK (purpose IN ('invite', 'reset'));

COMMIT;
