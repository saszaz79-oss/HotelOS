-- AlterEnum
-- Renamed to name the real work at each step precisely (Zero-Lag Sprint).
-- Existing rows are remapped explicitly (not a blind text cast) because
-- several old values were renamed, not just added: 'complete' -> 'completed'
-- and 'error' -> 'failed' do NOT share a string with their new-enum
-- counterpart, so a naive ::text::new_enum cast would fail against any
-- production row still holding one of those two values.
BEGIN;
CREATE TYPE "AnalysisSessionStage_new" AS ENUM ('queued', 'extracting', 'normalizing', 'validating', 'calculating_metrics', 'building_executive_score', 'generating_executive_intelligence', 'preparing_executive_report', 'completed', 'failed', 'stalled');
ALTER TABLE "AnalysisSession" ALTER COLUMN "currentStage" TYPE "AnalysisSessionStage_new" USING (
  CASE "currentStage"::text
    WHEN 'reading' THEN 'extracting'
    WHEN 'consistency' THEN 'validating'
    WHEN 'kpi' THEN 'calculating_metrics'
    WHEN 'score' THEN 'building_executive_score'
    WHEN 'executive_intelligence' THEN 'generating_executive_intelligence'
    WHEN 'report' THEN 'preparing_executive_report'
    WHEN 'pdf' THEN 'preparing_executive_report'
    WHEN 'complete' THEN 'completed'
    WHEN 'error' THEN 'failed'
    ELSE "currentStage"::text
  END
)::"AnalysisSessionStage_new";
ALTER TYPE "AnalysisSessionStage" RENAME TO "AnalysisSessionStage_old";
ALTER TYPE "AnalysisSessionStage_new" RENAME TO "AnalysisSessionStage";
DROP TYPE "public"."AnalysisSessionStage_old";
COMMIT;

-- AlterEnum
ALTER TYPE "AnalysisSessionStatus" ADD VALUE 'stalled';

-- AlterTable
ALTER TABLE "AnalysisSession" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "heartbeatAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3);

