-- Migration 046: move requests (additive)
--
-- Registering someone who already belongs to another CCF (a member there, or
-- a convert placed there) no longer creates a second record. It becomes a
-- request to move them, which the coordinator of their current CCF approves
-- or declines. Approving moves them as a transfer does.

BEGIN;

CREATE TABLE IF NOT EXISTS ccg_move_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       UUID NOT NULL REFERENCES ccg_people(id) ON DELETE CASCADE,
  kind            VARCHAR(10) NOT NULL CHECK (kind IN ('member', 'convert')),
  from_ccf_id     UUID REFERENCES ccg_families(id) ON DELETE SET NULL,
  to_ccf_id       UUID NOT NULL REFERENCES ccg_families(id) ON DELETE CASCADE,
  -- 'staff' (registered by a leader) or 'self' (the CCF's registration form)
  source          VARCHAR(10) NOT NULL CHECK (source IN ('staff', 'self')),
  requested_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  status          VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),
  decided_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at      TIMESTAMPTZ,
  decline_reason  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccg_move_requests_from ON ccg_move_requests(from_ccf_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ccg_move_requests_to ON ccg_move_requests(to_ccf_id) WHERE status = 'pending';
-- One open request per person and destination.
CREATE UNIQUE INDEX IF NOT EXISTS ccg_move_requests_open_unique ON ccg_move_requests(person_id, to_ccf_id) WHERE status = 'pending';

COMMIT;
