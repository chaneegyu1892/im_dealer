-- Inventory: hot-path indexes for status filtering & ordering
CREATE INDEX IF NOT EXISTS "Inventory_status_idx" ON "Inventory"("status");
CREATE INDEX IF NOT EXISTS "Inventory_updatedAt_idx" ON "Inventory"("updatedAt");

-- SavedQuote: archival / cleanup query indexes
CREATE INDEX IF NOT EXISTS "SavedQuote_expiresAt_idx" ON "SavedQuote"("expiresAt");
CREATE INDEX IF NOT EXISTS "SavedQuote_createdAt_idx" ON "SavedQuote"("createdAt");
