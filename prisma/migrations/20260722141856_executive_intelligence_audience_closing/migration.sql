/*
  Warnings:

  - Added the required column `closingStatement` to the `AiExecutiveIntelligence` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AiExecutiveIntelligence" ADD COLUMN     "audienceRecommendations" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "closingStatement" TEXT NOT NULL;
