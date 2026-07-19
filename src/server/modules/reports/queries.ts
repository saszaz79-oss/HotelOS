import { prisma } from '@/lib/prisma';
import { storage } from '@/server/modules/storage';

/** CQRS naming convention (Architecture §28): reads only, no state changes. */
export async function listReportUploads(hotelId: string, take = 50) {
  return prisma.reportUpload.findMany({
    where: { hotelId },
    orderBy: { createdAt: 'desc' },
    take,
    include: { uploadedBy: { select: { displayName: true } }, documents: true },
  });
}

const ARCHIVE_PAGE_SIZE = 20;

/** Paginated report history (Reports Archive) — listReportUploads' fixed `take` was never meant for the full history, only a "recent uploads" preview on the upload page. */
export async function listReportUploadsPage(hotelId: string, page: number) {
  const skip = Math.max(0, page - 1) * ARCHIVE_PAGE_SIZE;
  const [uploads, total] = await Promise.all([
    prisma.reportUpload.findMany({
      where: { hotelId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: ARCHIVE_PAGE_SIZE,
      include: { uploadedBy: { select: { displayName: true } }, documents: { select: { reportType: true } } },
    }),
    prisma.reportUpload.count({ where: { hotelId } }),
  ]);
  return { uploads, total, pageSize: ARCHIVE_PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / ARCHIVE_PAGE_SIZE)) };
}

export async function getReportUpload(hotelId: string, reportUploadId: string) {
  return prisma.reportUpload.findFirst({
    where: { id: reportUploadId, hotelId },
    include: { documents: { include: { extractionJobs: true, metrics: true } } },
  });
}

/**
 * Tenant isolation here comes from the same seam every other query in this
 * file uses: `hotelId` is scoped from the caller's own session/membership,
 * never from client-supplied input, and the lookup is filtered by it — a
 * reportUploadId belonging to another hotel resolves to `null`, never a URL.
 * The signed URL itself is short-lived and never persisted.
 */
export async function getReportUploadSignedUrl(
  hotelId: string,
  reportUploadId: string
): Promise<string | null> {
  const upload = await prisma.reportUpload.findFirst({
    where: { id: reportUploadId, hotelId },
    select: { storageKey: true },
  });
  if (!upload) return null;

  try {
    return await storage.getSignedUrl(upload.storageKey);
  } catch (err) {
    console.error('[reports.getReportUploadSignedUrl] failed', { hotelId, reportUploadId, error: err });
    return null;
  }
}
