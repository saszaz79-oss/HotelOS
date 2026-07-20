-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('upload_completed', 'upload_failed', 'needs_review', 'brief_ready', 'hotel_suspended', 'password_reset', 'feature_toggled', 'kpi_warning');

-- CreateEnum
CREATE TYPE "NotificationScope" AS ENUM ('platform', 'hotel');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "scope" "NotificationScope" NOT NULL,
    "hotelId" TEXT,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "bodyEn" TEXT,
    "bodyAr" TEXT,
    "sourceRef" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_hotelId_createdAt_idx" ON "Notification"("hotelId", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
