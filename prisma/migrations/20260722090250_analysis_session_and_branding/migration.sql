-- EDI Phase 1: Analysis Session workflow model + hotel branding fields for
-- the Executive Intelligence Report cover page. Purely additive — new
-- table, new nullable columns, new enum values. No existing data touched.

-- AlterEnum
ALTER TYPE "ReportType" ADD VALUE 'HISTORY_FORECAST';
ALTER TYPE "ReportType" ADD VALUE 'DAY_MTD_YTD_STATISTICS';

-- AlterTable: Hotel branding
ALTER TABLE "Hotel" ADD COLUMN     "officialNameAr" TEXT,
ADD COLUMN     "officialNameEn" TEXT,
ADD COLUMN     "propertyCode" TEXT,
ADD COLUMN     "generalManagerName" TEXT,
ADD COLUMN     "generalManagerTitle" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "reportFooterText" TEXT;

-- CreateEnum
CREATE TYPE "AnalysisSessionStatus" AS ENUM ('collecting', 'analyzing', 'ready', 'error');

-- CreateEnum
CREATE TYPE "AnalysisSessionStage" AS ENUM ('reading', 'extracting', 'normalizing', 'consistency', 'kpi', 'score', 'executive_intelligence', 'report', 'pdf', 'complete', 'error');

-- CreateTable
CREATE TABLE "AnalysisSession" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "status" "AnalysisSessionStatus" NOT NULL DEFAULT 'collecting',
    "currentStage" "AnalysisSessionStage",
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "AnalysisSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalysisSession_hotelId_status_idx" ON "AnalysisSession"("hotelId", "status");

-- CreateIndex
CREATE INDEX "AnalysisSession_hotelId_businessDate_idx" ON "AnalysisSession"("hotelId", "businessDate");

-- AddForeignKey
ALTER TABLE "AnalysisSession" ADD CONSTRAINT "AnalysisSession_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisSession" ADD CONSTRAINT "AnalysisSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: ReportUpload -> AnalysisSession link
ALTER TABLE "ReportUpload" ADD COLUMN     "analysisSessionId" TEXT;

-- CreateIndex
CREATE INDEX "ReportUpload_analysisSessionId_idx" ON "ReportUpload"("analysisSessionId");

-- AddForeignKey
ALTER TABLE "ReportUpload" ADD CONSTRAINT "ReportUpload_analysisSessionId_fkey" FOREIGN KEY ("analysisSessionId") REFERENCES "AnalysisSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
