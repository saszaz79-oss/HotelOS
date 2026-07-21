-- Analytics fix Phase 6: structured owner/timeframe/expected-outcome fields
-- on Recommendation, replacing the display-time-only guess previously
-- computed from supportingMetrics. All nullable — existing rows are not
-- backfilled and must render as "not available" rather than a fabricated
-- value.

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "owner" "HotelRole",
ADD COLUMN     "timeframe" TEXT,
ADD COLUMN     "expectedOutcomeEn" TEXT,
ADD COLUMN     "expectedOutcomeAr" TEXT;
