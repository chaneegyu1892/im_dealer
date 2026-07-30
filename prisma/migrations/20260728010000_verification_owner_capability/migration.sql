-- Bind newly-created verification records to the authenticated Supabase user.
-- Existing ownerless rows remain readable to staff but cannot be mutated by members.
ALTER TABLE "CustomerVerification"
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- PostgreSQL permits multiple NULL values here, preserving legacy ownerless rows
-- while making newly-created (non-NULL owner) consent retries idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerVerification_sessionId_userId_key"
  ON "CustomerVerification"("sessionId", "userId");

CREATE INDEX IF NOT EXISTS "CustomerVerification_userId_idx"
  ON "CustomerVerification"("userId");
