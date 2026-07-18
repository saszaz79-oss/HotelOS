-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ar', 'en');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "HotelStatus" AS ENUM ('active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "HotelRole" AS ENUM ('HOTEL_ADMIN', 'GENERAL_MANAGER', 'FRONT_OFFICE_MANAGER', 'REVENUE_MANAGER', 'ANALYST', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "ReportUploadStatus" AS ENUM ('uploaded', 'processing', 'needs_review', 'complete', 'error');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('MANAGER_FLASH', 'RESERVATION_STATISTICS', 'OPEN_BALANCE', 'RESERVATION_STATISTICS_1', 'GENERIC');

-- CreateEnum
CREATE TYPE "DataQualityValidationStatus" AS ENUM ('passed', 'flagged', 'failed');

-- CreateEnum
CREATE TYPE "ExtractionStage" AS ENUM ('upload', 'extract', 'validate', 'normalize', 'analyze', 'complete', 'error');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('critical', 'warning', 'info');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('open', 'acknowledged', 'resolved');

-- CreateEnum
CREATE TYPE "RecommendationCategory" AS ENUM ('risk', 'opportunity', 'action');

-- CreateEnum
CREATE TYPE "AIMessageRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "TimelineEventType" AS ENUM ('report_uploaded', 'report_extracted', 'report_finalized', 'metric_corrected', 'alert_raised', 'alert_resolved', 'recommendation_issued', 'ai_conversation', 'ai_summary_generated', 'export_generated', 'decision_logged');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('generated', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "preferredLanguage" "Language" NOT NULL DEFAULT 'ar',
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "totalRooms" INTEGER NOT NULL,
    "roomTypes" JSONB NOT NULL DEFAULT '[]',
    "pmsType" TEXT,
    "licenseStartDate" TIMESTAMP(3),
    "licenseExpiryDate" TIMESTAMP(3),
    "status" "HotelStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "role" "HotelRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportUpload" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" "ReportUploadStatus" NOT NULL DEFAULT 'uploaded',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportDocument" (
    "id" TEXT NOT NULL,
    "reportUploadId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "detectedReportDate" TIMESTAMP(3),
    "confirmedReportDate" TIMESTAMP(3),
    "extractionConfidence" DOUBLE PRECISION,
    "rawExtractedText" TEXT,
    "checksumSha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completenessScore" DOUBLE PRECISION,
    "validationStatus" "DataQualityValidationStatus",
    "qualityNotes" JSONB NOT NULL DEFAULT '[]',
    "parserWarnings" JSONB NOT NULL DEFAULT '[]',
    "extractedFields" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ReportDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionGroundTruth" (
    "id" TEXT NOT NULL,
    "reportDocumentId" TEXT NOT NULL,
    "expectedFields" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractionGroundTruth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionJob" (
    "id" TEXT NOT NULL,
    "reportDocumentId" TEXT NOT NULL,
    "stage" "ExtractionStage" NOT NULL DEFAULT 'upload',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "ExtractionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricDefinition" (
    "key" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "isComputed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MetricDefinition_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "HotelMetric" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "metricDate" TIMESTAMP(3) NOT NULL,
    "metricKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "sourceReportDocumentId" TEXT,
    "isManuallyCorrected" BOOLEAN NOT NULL DEFAULT false,
    "correctedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "insightDate" TIMESTAMP(3) NOT NULL,
    "healthScore" DOUBLE PRECISION,
    "healthScoreFactors" JSONB NOT NULL DEFAULT '[]',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "insightId" TEXT,
    "severity" "AlertSeverity" NOT NULL,
    "category" TEXT NOT NULL,
    "messageEn" TEXT NOT NULL,
    "messageAr" TEXT NOT NULL,
    "relatedMetricKey" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "insightId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "textEn" TEXT NOT NULL,
    "textAr" TEXT NOT NULL,
    "suggestedActionEn" TEXT NOT NULL,
    "suggestedActionAr" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "supportingMetrics" JSONB NOT NULL DEFAULT '[]',
    "category" "RecommendationCategory" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL DEFAULT 'executive-agent',
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AIMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "citedSources" JSONB NOT NULL DEFAULT '[]',
    "messageType" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "eventType" "TimelineEventType" NOT NULL,
    "actorUserId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportedReport" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "generatedByUserId" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "storageKey" TEXT,
    "status" "ExportStatus" NOT NULL DEFAULT 'generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportedReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelSetting" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "HotelSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'pilot',
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentPeriodEnd" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "HotelMembership_hotelId_userId_idx" ON "HotelMembership"("hotelId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelMembership_userId_hotelId_key" ON "HotelMembership"("userId", "hotelId");

-- CreateIndex
CREATE INDEX "ReportUpload_hotelId_createdAt_idx" ON "ReportUpload"("hotelId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportDocument_hotelId_reportType_confirmedReportDate_idx" ON "ReportDocument"("hotelId", "reportType", "confirmedReportDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractionGroundTruth_reportDocumentId_key" ON "ExtractionGroundTruth"("reportDocumentId");

-- CreateIndex
CREATE INDEX "ExtractionJob_reportDocumentId_idx" ON "ExtractionJob"("reportDocumentId");

-- CreateIndex
CREATE INDEX "HotelMetric_hotelId_metricDate_idx" ON "HotelMetric"("hotelId", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "HotelMetric_hotelId_metricDate_metricKey_key" ON "HotelMetric"("hotelId", "metricDate", "metricKey");

-- CreateIndex
CREATE INDEX "Insight_hotelId_insightDate_idx" ON "Insight"("hotelId", "insightDate");

-- CreateIndex
CREATE UNIQUE INDEX "Insight_hotelId_insightDate_key" ON "Insight"("hotelId", "insightDate");

-- CreateIndex
CREATE INDEX "Alert_hotelId_createdAt_idx" ON "Alert"("hotelId", "createdAt");

-- CreateIndex
CREATE INDEX "Recommendation_hotelId_createdAt_idx" ON "Recommendation"("hotelId", "createdAt");

-- CreateIndex
CREATE INDEX "AIConversation_hotelId_userId_createdAt_idx" ON "AIConversation"("hotelId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON "AIMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "TimelineEvent_hotelId_createdAt_idx" ON "TimelineEvent"("hotelId", "createdAt");

-- CreateIndex
CREATE INDEX "ExportedReport_hotelId_createdAt_idx" ON "ExportedReport"("hotelId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_hotelId_createdAt_idx" ON "AuditLog"("hotelId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HotelSetting_hotelId_key_key" ON "HotelSetting"("hotelId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_hotelId_key" ON "Subscription"("hotelId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelMembership" ADD CONSTRAINT "HotelMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelMembership" ADD CONSTRAINT "HotelMembership_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportUpload" ADD CONSTRAINT "ReportUpload_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportUpload" ADD CONSTRAINT "ReportUpload_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDocument" ADD CONSTRAINT "ReportDocument_reportUploadId_fkey" FOREIGN KEY ("reportUploadId") REFERENCES "ReportUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionGroundTruth" ADD CONSTRAINT "ExtractionGroundTruth_reportDocumentId_fkey" FOREIGN KEY ("reportDocumentId") REFERENCES "ReportDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionGroundTruth" ADD CONSTRAINT "ExtractionGroundTruth_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionJob" ADD CONSTRAINT "ExtractionJob_reportDocumentId_fkey" FOREIGN KEY ("reportDocumentId") REFERENCES "ReportDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelMetric" ADD CONSTRAINT "HotelMetric_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelMetric" ADD CONSTRAINT "HotelMetric_metricKey_fkey" FOREIGN KEY ("metricKey") REFERENCES "MetricDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelMetric" ADD CONSTRAINT "HotelMetric_sourceReportDocumentId_fkey" FOREIGN KEY ("sourceReportDocumentId") REFERENCES "ReportDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelMetric" ADD CONSTRAINT "HotelMetric_correctedByUserId_fkey" FOREIGN KEY ("correctedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "Insight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "Insight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportedReport" ADD CONSTRAINT "ExportedReport_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportedReport" ADD CONSTRAINT "ExportedReport_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelSetting" ADD CONSTRAINT "HotelSetting_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
