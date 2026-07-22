-- Perf fix, Phase 1B: persisted AI Executive Summary. Before this table,
-- generateExecutiveSummary() ran on every single page render of Mission
-- Control and Executive Export with no caching. One row per
-- (hotel, date, language); read through getOrRefreshExecutiveSummary().

-- CreateTable
CREATE TABLE "AiExecutiveSummary" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "metricDate" TIMESTAMP(3) NOT NULL,
    "language" "Language" NOT NULL,
    "summaryText" TEXT NOT NULL,
    "citedMetrics" JSONB NOT NULL DEFAULT '[]',
    "model" TEXT NOT NULL,
    "promptVersion" INTEGER NOT NULL,
    "analysisVersion" INTEGER NOT NULL,
    "sourceReportDocumentId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByUserId" TEXT,

    CONSTRAINT "AiExecutiveSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiExecutiveSummary_hotelId_metricDate_idx" ON "AiExecutiveSummary"("hotelId", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "AiExecutiveSummary_hotelId_metricDate_language_key" ON "AiExecutiveSummary"("hotelId", "metricDate", "language");

-- AddForeignKey
ALTER TABLE "AiExecutiveSummary" ADD CONSTRAINT "AiExecutiveSummary_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExecutiveSummary" ADD CONSTRAINT "AiExecutiveSummary_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
