-- Performance sprint round 2: indexes for hot query paths identified by
-- production profiling (Alert/Recommendation filtered by insightId on every
-- Mission Control load; ReportUpload filtered by status/uploadedByUserId on
-- every Reports Archive load; Hotel filtered by status on every membership
-- lookup; Notification filtered by userId+readAt on every layout render).

-- CreateIndex
CREATE INDEX "Hotel_status_idx" ON "Hotel"("status");

-- CreateIndex
CREATE INDEX "ReportUpload_hotelId_status_idx" ON "ReportUpload"("hotelId", "status");

-- CreateIndex
CREATE INDEX "ReportUpload_hotelId_uploadedByUserId_idx" ON "ReportUpload"("hotelId", "uploadedByUserId");

-- CreateIndex
CREATE INDEX "Alert_insightId_idx" ON "Alert"("insightId");

-- CreateIndex
CREATE INDEX "Recommendation_insightId_idx" ON "Recommendation"("insightId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
