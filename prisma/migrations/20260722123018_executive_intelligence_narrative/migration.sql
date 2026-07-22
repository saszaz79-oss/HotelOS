-- CreateTable
CREATE TABLE "AiExecutiveIntelligence" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "metricDate" TIMESTAMP(3) NOT NULL,
    "language" "Language" NOT NULL,
    "executiveMessage" TEXT NOT NULL,
    "crossKpiNarrative" TEXT NOT NULL,
    "riskElaboration" JSONB NOT NULL DEFAULT '{}',
    "opportunityElaboration" JSONB NOT NULL DEFAULT '{}',
    "businessImpactEstimates" JSONB NOT NULL DEFAULT '{}',
    "decisionSummaryText" TEXT NOT NULL,
    "forecastNarrative" TEXT,
    "model" TEXT NOT NULL,
    "promptVersion" INTEGER NOT NULL,
    "analysisVersion" INTEGER NOT NULL,
    "sourceReportDocumentId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByUserId" TEXT,

    CONSTRAINT "AiExecutiveIntelligence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiExecutiveIntelligence_hotelId_metricDate_idx" ON "AiExecutiveIntelligence"("hotelId", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "AiExecutiveIntelligence_hotelId_metricDate_language_key" ON "AiExecutiveIntelligence"("hotelId", "metricDate", "language");

-- AddForeignKey
ALTER TABLE "AiExecutiveIntelligence" ADD CONSTRAINT "AiExecutiveIntelligence_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExecutiveIntelligence" ADD CONSTRAINT "AiExecutiveIntelligence_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
