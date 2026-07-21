import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { storage } from '@/server/modules/storage';
import type { Prisma, ReportType, ReportUploadStatus } from '@prisma/client';

/**
 * CQRS naming convention (Architecture §28): reads only, no state changes.
 *
 * No `documents` relation fetched — both callers (Mission Control's recent-
 * uploads list, Reports Upload's history list) only ever render
 * id/originalFilename/createdAt/status, never `u.documents`. The prior
 * `documents: true` pulled every ReportDocument column (including
 * rawExtractedText and JSON blobs) per upload for data nothing read
 * (Perf sprint round 2).
 */
export const listReportUploads = cache(async (hotelId: string, take = 50) => {
  return prisma.reportUpload.findMany({
    where: { hotelId },
    orderBy: { createdAt: 'desc' },
    take,
    include: { uploadedBy: { select: { displayName: true } } },
  });
});

const ARCHIVE_PAGE_SIZE = 20;

export interface ListReportUploadsFilter {
  search?: string;
  reportType?: ReportType;
  status?: ReportUploadStatus;
  uploadedByUserId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/** Paginated report history (Reports Archive) — listReportUploads' fixed `take` was never meant for the full history, only a "recent uploads" preview on the upload page. */
export const listReportUploadsPage = cache(async (hotelId: string, page: number, filter: ListReportUploadsFilter = {}) => {
  const where: Prisma.ReportUploadWhereInput = { hotelId };
  if (filter.search) where.originalFilename = { contains: filter.search, mode: 'insensitive' };
  if (filter.status) where.status = filter.status;
  if (filter.uploadedByUserId) where.uploadedByUserId = filter.uploadedByUserId;
  if (filter.reportType) where.documents = { some: { reportType: filter.reportType } };
  if (filter.dateFrom || filter.dateTo) {
    where.createdAt = {
      ...(filter.dateFrom ? { gte: filter.dateFrom } : {}),
      ...(filter.dateTo ? { lte: filter.dateTo } : {}),
    };
  }

  const skip = Math.max(0, page - 1) * ARCHIVE_PAGE_SIZE;
  const [uploads, total] = await Promise.all([
    prisma.reportUpload.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: ARCHIVE_PAGE_SIZE,
      include: {
        uploadedBy: { select: { displayName: true } },
        documents: { select: { reportType: true, completenessScore: true, updatedAt: true } },
      },
    }),
    prisma.reportUpload.count({ where }),
  ]);
  return { uploads, total, pageSize: ARCHIVE_PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / ARCHIVE_PAGE_SIZE)) };
});

/** Distinct uploaders for a hotel — backs the archive's "uploaded by" filter. */
export const listReportUploaders = cache(async (hotelId: string) => {
  const uploads = await prisma.reportUpload.findMany({
    where: { hotelId },
    distinct: ['uploadedByUserId'],
    select: { uploadedByUserId: true, uploadedBy: { select: { displayName: true } } },
  });
  return uploads.map((u) => ({ id: u.uploadedByUserId, displayName: u.uploadedBy.displayName }));
});

/**
 * `documents` is a narrow `select`, not `include: true` — neither this
 * function's 3 call sites (the report detail page, and two server actions
 * that only check `documents.some(d => d.id === reportDocumentId)`) ever
 * read `extractionJobs` or `metrics`, so fetching those relations in full
 * was pure wasted query cost (Perf sprint, M14).
 */
export const getReportUpload = cache(async (hotelId: string, reportUploadId: string) => {
  return prisma.reportUpload.findFirst({
    where: { id: reportUploadId, hotelId },
    include: {
      uploadedBy: { select: { displayName: true } },
      documents: {
        select: {
          id: true,
          reportType: true,
          detectedReportDate: true,
          completenessScore: true,
          validationStatus: true,
          qualityNotes: true,
          parserWarnings: true,
          extractedFields: true,
        },
      },
    },
  });
});

/**
 * Tenant isolation here comes from the same seam every other query in this
 * file uses: `hotelId` is scoped from the caller's own session/membership,
 * never from client-supplied input, and the lookup is filtered by it — a
 * reportUploadId belonging to another hotel resolves to `null`, never a URL.
 * The signed URL itself is short-lived and never persisted.
 */
/**
 * Takes `storageKey` directly rather than re-fetching the upload by id — its
 * one caller (the report detail page) already has the full upload record
 * (storageKey included) from its own `getReportUpload` call moments earlier;
 * a second by-id lookup for a single already-known field was a wasted round
 * trip (Perf sprint, M14).
 */
export async function getReportUploadSignedUrl(storageKey: string, context: { hotelId: string; reportUploadId: string }): Promise<string | null> {
  try {
    return await storage.getSignedUrl(storageKey);
  } catch (err) {
    console.error('[reports.getReportUploadSignedUrl] failed', { hotelId: context.hotelId, reportUploadId: context.reportUploadId, error: err });
    return null;
  }
}
