-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_hotelId_action_createdAt_idx" ON "AuditLog"("hotelId", "action", "createdAt");

