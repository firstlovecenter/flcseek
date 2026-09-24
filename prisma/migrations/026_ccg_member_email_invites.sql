-- Migration 026: member email, and invitations to set a password
--
-- Every CCG role is held by a member. When a member without a login is given a
-- role, a login is created for them (their email is the sign-in name) and they
-- are emailed a link to choose their own password. Nobody sets a password on
-- someone else's behalf. Phone numbers are kept for SMS later.
--
-- Apply after 025:  npx tsx scripts/ccg-apply-migration.ts prisma/migrations/026_ccg_member_email_invites.sql

BEGIN;

ALTER TABLE ccg_people ADD COLUMN IF NOT EXISTS email VARCHAR(254);
CREATE INDEX IF NOT EXISTS idx_ccg_people_email ON ccg_people(lower(email)) WHERE deleted_at IS NULL AND email IS NOT NULL;

-- One-time links to set a password. Only the SHA-256 of the token is stored.
CREATE TABLE IF NOT EXISTS ccg_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_id   UUID REFERENCES ccg_people(id) ON DELETE SET NULL,
  token_hash  CHAR(64) NOT NULL UNIQUE,
  sent_to     VARCHAR(254) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ccg_invites_user ON ccg_invites(user_id, created_at DESC);

COMMIT;
