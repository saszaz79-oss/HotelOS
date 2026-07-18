import { prisma } from '@/lib/prisma';

/** CQRS naming convention (Architecture §28): reads only, no state changes. */
export async function listReportUploads(hotelId: string, take = 50) {
  return prisma.reportUpload.findMany({
    where: { hotelId },
    orderBy: { createdAt: 'desc' },
    take,
    include: { uploadedBy: { select: { displayName: true } }, documents: true },
  });
}

export async function getReportUpload(hotelId: string, reportUploadId: string) {
  return prisma.reportUpload.findFirst({
    where: { id: reportUploadId, hotelId },
    include: { documents: { include: { extractionJobs: true, metrics: true } } },
  });
}
